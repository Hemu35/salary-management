module Api
  class ReportsController < BaseController
    # GET /api/reports/workforce
    def workforce
      with_tenant_context do
        scope = current_tenant.employees.includes(:domain)
        scope = apply_domain_scope(scope)
        return if performed?

        total_count = scope.count
        by_status_raw = scope.group(:employment_status).count
        by_country_raw = scope.group(:country_code).count
        by_domain_raw = scope.joins(:domain).group("domains.id", "domains.name").count

        country_names = {
          "US" => "United States",
          "GB" => "United Kingdom",
          "IN" => "India",
          "CA" => "Canada",
          "DE" => "Germany"
        }
        country_flags = {
          "US" => "🇺🇸",
          "GB" => "🇬🇧",
          "IN" => "🇮🇳",
          "CA" => "🇨🇦",
          "DE" => "🇩🇪"
        }

        by_country = by_country_raw.map do |code, count|
          pct = total_count.positive? ? ((count.to_f / total_count) * 100).round(1) : 0.0
          {
            country_code: code,
            country_name: country_names[code] || code,
            flag: country_flags[code] || "🌐",
            count: count,
            percentage: pct
          }
        end.sort_by { |c| -c[:count] }

        by_domain = by_domain_raw.map do |(dom_id, dom_name), count|
          pct = total_count.positive? ? ((count.to_f / total_count) * 100).round(1) : 0.0
          {
            domain_id: dom_id,
            domain_name: dom_name,
            count: count,
            percentage: pct
          }
        end.sort_by { |d| -d[:count] }

        by_status = by_status_raw.map do |status, count|
          pct = total_count.positive? ? ((count.to_f / total_count) * 100).round(1) : 0.0
          {
            status: status,
            count: count,
            percentage: pct
          }
        end.sort_by { |s| -s[:count] }

        render json: {
          total_headcount: total_count,
          active_headcount: by_status_raw["active"] || 0,
          on_leave_headcount: by_status_raw["on_leave"] || 0,
          terminated_headcount: by_status_raw["terminated"] || 0,
          by_country: by_country,
          by_domain: by_domain,
          by_status: by_status
        }, status: :ok
      end
    end

    # GET /api/reports/compensation
    def compensation
      with_tenant_context do
        scope = current_tenant.employees.includes(:domain, compensation_records: :compensation_components)
        scope = apply_domain_scope(scope)
        return if performed?

        # Group strictly by currency: ZERO cross-currency summation (PRD §5.6, §8)
        records_by_currency = Hash.new { |h, k| h[k] = [] }

        scope.find_each do |emp|
          active_record = emp.compensation_records.find { |r| r.status == "active" }
          next unless active_record

          records_by_currency[active_record.currency] << {
            employee: emp,
            record: active_record
          }
        end

        currencies_report = records_by_currency.keys.sort.map do |curr|
          items = records_by_currency[curr]
          emp_count = items.size

          annualized_totals = items.map { |item| item[:record].total_annualized_compensation }
          total_budget = annualized_totals.sum
          avg_comp = emp_count.positive? ? (total_budget / emp_count).round(2) : BigDecimal("0.00")
          min_comp = annualized_totals.min || BigDecimal("0.00")
          max_comp = annualized_totals.max || BigDecimal("0.00")

          sorted_totals = annualized_totals.sort
          median_comp = if emp_count.zero?
                          BigDecimal("0.00")
                        elsif emp_count.odd?
                          sorted_totals[emp_count / 2]
                        else
                          ((sorted_totals[(emp_count / 2) - 1] + sorted_totals[emp_count / 2]) / 2).round(2)
                        end

          component_totals = Hash.new(BigDecimal("0.00"))
          items.each do |item|
            item[:record].compensation_components.each do |comp|
              component_totals[comp.component_type] += comp.annualized_amount
            end
          end

          domain_groups = items.group_by { |item| [item[:employee].domain_id, item[:employee].domain.name] }
          domain_stats = domain_groups.map do |(dom_id, dom_name), dom_items|
            dom_totals = dom_items.map { |item| item[:record].total_annualized_compensation }
            dom_total = dom_totals.sum
            {
              domain_id: dom_id,
              domain_name: dom_name,
              employee_count: dom_items.size,
              total_annualized_budget: dom_total.to_f,
              avg_annualized_compensation: (dom_total / dom_items.size).round(2).to_f
            }
          end.sort_by { |d| -d[:total_annualized_budget] }

          {
            currency: curr,
            employee_count: emp_count,
            total_annualized_budget: total_budget.to_f,
            avg_annualized_compensation: avg_comp.to_f,
            median_annualized_compensation: median_comp.to_f,
            min_annualized_compensation: min_comp.to_f,
            max_annualized_compensation: max_comp.to_f,
            component_breakdown: {
              base_salary: (component_totals["base_salary"] || 0).to_f,
              bonus: (component_totals["bonus"] || 0).to_f,
              allowance: (component_totals["allowance"] || 0).to_f,
              stock_grant: (component_totals["stock_grant"] || 0).to_f,
              commission: (component_totals["commission"] || 0).to_f
            },
            by_domain: domain_stats
          }
        end

        render json: {
          currencies: currencies_report
        }, status: :ok
      end
    end

    private

    def apply_domain_scope(scope)
      if params[:domain_id].present?
        domain_id = params[:domain_id].to_i
        unless accessible_domain_ids.include?(domain_id)
          render json: { error: "Forbidden: domain outside assigned scope" }, status: :forbidden
          return nil
        end
        scope.where(domain_id: domain_id)
      else
        if current_user.organization_admin?
          scope
        else
          scope.where(domain_id: accessible_domain_ids)
        end
      end
    end
  end
end
