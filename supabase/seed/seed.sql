-- OPTIONAL DEVELOPMENT SEED
-- Run only after creating an Auth user and bootstrapping an organization through /setup.
-- Replace the UUID below with your organization id.
\set org_id '00000000-0000-0000-0000-000000000000'
insert into public.contacts(organization_id,full_name,email,phone,branch,customer_type) values
(:'org_id','Amina Bello','amina@example.com','+2348010000001','Main','Retail'),
(:'org_id','Chinedu Okafor','chinedu@example.com','+2348010000002','Island','SME'),
(:'org_id','Tolu Adeyemi','tolu@example.com','+2348010000003','Main','Retail');
insert into public.campaigns(organization_id,name,status,subject,channel) values
(:'org_id','Welcome Campaign','completed','Welcome to our community','email'),
(:'org_id','Customer Reactivation','draft','We would love to have you back','email');
