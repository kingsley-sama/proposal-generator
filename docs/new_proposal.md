  2. Fields needed to seed public.projects — project_id, project_manager,
  pm_type, sales_person, email_id (FK), person_id (FK), company_email,          
  client_contact_name, construction_type, property_type, questionnaire_received,
   deposit, initial_project_status, path_to_files. All use the existing         
  project-side enums (public.pm_type, public.construction_type_values, etc.).
  3. Lifecycle — proposal_status (draft / sent / viewed / accepted / rejected /
  expired) plus raw_payload jsonb + payload_version for a lossless audit-trail  
  snapshot, indexed with GIN so future form fields don't require new migrations.