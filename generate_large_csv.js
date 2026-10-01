const fs = require('fs');
const path = require('path');

const firstNames = [
  'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth',
  'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
  'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Donald', 'Sandra',
  'Mark', 'Ashley', 'Paul', 'Kimberly', 'Steven', 'Emily', 'Andrew', 'Donna', 'Kenneth', 'Michelle',
  'Joshua', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Melissa', 'George', 'Deborah', 'Edward', 'Stephanie',
  'Liam', 'Olivia', 'Noah', 'Emma', 'Oliver', 'Charlotte', 'Elijah', 'Amelia', 'James', 'Ava',
  'William', 'Sophia', 'Benjamin', 'Isabella', 'Lucas', 'Mia', 'Henry', 'Evelyn', 'Theodore', 'Harper',
  'Jack', 'Camila', 'Levi', 'Gianna', 'Alexander', 'Abigail', 'Jackson', 'Luna', 'Mateo', 'Ella'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts'
];

const engTitles = [
  'Junior Software Engineer', 'Software Engineer', 'Senior Software Engineer', 'Staff Engineer', 'Principal Engineer',
  'Frontend Developer', 'Backend Developer', 'Fullstack Engineer', 'DevOps Engineer', 'Site Reliability Engineer',
  'QA Automation Engineer', 'Cloud Architect', 'Security Engineer', 'Data Engineer', 'Engineering Manager'
];

const salesTitles = [
  'Sales Development Rep', 'Account Executive', 'Senior Account Executive', 'Enterprise Account Exec',
  'Director of Sales', 'Customer Success Manager', 'Growth Marketing Specialist', 'Product Marketing Manager',
  'Head of Partnerships', 'Inbound Sales Specialist', 'Marketing Operations Lead', 'VP of Global Sales'
];

const countries = ['US', 'GB', 'DE', 'CA', 'FR', 'NL', 'AU', 'SG', 'IE'];
const currencies = {
  'US': 'USD', 'GB': 'GBP', 'DE': 'EUR', 'CA': 'CAD',
  'FR': 'EUR', 'NL': 'EUR', 'AU': 'AUD', 'SG': 'SGD', 'IE': 'EUR'
};

const headers = [
  'employee_number',
  'first_name',
  'last_name',
  'email',
  'domain_name',
  'country_code',
  'job_title',
  'employment_status',
  'hire_date',
  'currency',
  'pay_frequency',
  'base_salary',
  'bonus',
  'commission',
  'allowance',
  'notes'
];

const rows = [headers.join(',')];

for (let i = 1; i <= 1000; i++) {
  const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const empNum = 'EMP' + String(1000 + i);
  const email = fName.toLowerCase() + '.' + lName.toLowerCase() + '.' + i + '@acmecorp.internal';
  
  // 60% Engineering, 40% Sales & Marketing
  const isEng = Math.random() < 0.6;
  const domain = isEng ? 'Engineering' : 'Sales & Marketing';
  const titleList = isEng ? engTitles : salesTitles;
  const title = titleList[Math.floor(Math.random() * titleList.length)];
  
  const country = countries[Math.floor(Math.random() * countries.length)];
  const currency = currencies[country] || 'USD';
  
  const statusRoll = Math.random();
  const status = statusRoll > 0.08 ? 'active' : (statusRoll > 0.03 ? 'on_leave' : 'terminated');
  
  // Random hire date between 2021 and 2026
  const year = 2021 + Math.floor(Math.random() * 5);
  const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
  const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
  const hireDate = `${year}-${month}-${day}`;
  
  // Salary based on title seniority
  let baseSalary = 75000 + Math.floor(Math.random() * 85000);
  if (title.includes('Senior') || title.includes('Lead')) baseSalary += 35000;
  if (title.includes('Staff') || title.includes('Principal') || title.includes('Director') || title.includes('VP')) baseSalary += 70000;
  
  const bonus = Math.floor(baseSalary * (0.05 + Math.random() * 0.15));
  const commission = !isEng ? Math.floor(baseSalary * (0.10 + Math.random() * 0.20)) : 0;
  const allowance = Math.random() > 0.5 ? 5000 + Math.floor(Math.random() * 10000) : 0;
  
  rows.push([
    empNum,
    fName,
    lName,
    email,
    `"${domain}"`,
    country,
    `"${title}"`,
    status,
    hireDate,
    currency,
    'annual',
    baseSalary.toFixed(2),
    bonus.toFixed(2),
    commission.toFixed(2),
    allowance.toFixed(2),
    `"Bulk batch generation row ${i}"`
  ].join(','));
}

const csvOutput = rows.join('\n');

// Write to root workspace
fs.writeFileSync('sample_large_employees_1000.csv', csvOutput, 'utf8');

// Also write to frontend/public for instant browser download
fs.mkdirSync('frontend/public', { recursive: true });
fs.writeFileSync('frontend/public/sample_large_employees_1000.csv', csvOutput, 'utf8');

console.log(`Successfully generated sample_large_employees_1000.csv with ${rows.length - 1} rows!`);
