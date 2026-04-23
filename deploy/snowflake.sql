-- ============================================================
-- Snowflake Excel Add-in — SPCS Deployment
-- Run these statements in order in Snowsight or SnowSQL
-- Replace <ACCOUNT> with your account identifier (e.g. myorg-myaccount)
-- ============================================================

-- 1. Database + schema to host the image repository and service
CREATE DATABASE IF NOT EXISTS EXCEL_ADDIN_DB;
CREATE SCHEMA IF NOT EXISTS EXCEL_ADDIN_DB.APP;

USE DATABASE EXCEL_ADDIN_DB;
USE SCHEMA APP;

-- 2. Image repository (Snowflake's private container registry)
CREATE IMAGE REPOSITORY IF NOT EXISTS EXCEL_ADDIN_REPO;

-- Check the repository URL — you'll need this for docker push
SHOW IMAGE REPOSITORIES IN SCHEMA EXCEL_ADDIN_DB.APP;
-- Note the repository_url column e.g.:
-- <account>.registry.snowflakecomputing.com/excel_addin_db/app/excel_addin_repo

-- 3. OAuth Security Integration
--    This registers the add-in as an OAuth client with Snowflake.
--    Users will see the standard Snowflake login page when signing in.
--    NOTE: After creating, run DESCRIBE to get the CLIENT_ID.
CREATE SECURITY INTEGRATION IF NOT EXISTS SNOWFLAKE_EXCEL_ADDIN
  TYPE = OAUTH
  ENABLED = TRUE
  OAUTH_CLIENT = CUSTOM
  OAUTH_CLIENT_TYPE = 'PUBLIC'
  OAUTH_REDIRECT_URI = 'https://<SPCS_ENDPOINT>/oauth/callback'
  OAUTH_ISSUE_REFRESH_TOKENS = TRUE
  OAUTH_REFRESH_TOKEN_VALIDITY = 86400
  COMMENT = 'OAuth integration for the Snowflake Excel Add-in';

-- Get the CLIENT_ID to put in your .env / SPCS service spec
SELECT SYSTEM$SHOW_OAUTH_CLIENT_SECRETS('SNOWFLAKE_EXCEL_ADDIN');
-- Returns JSON — copy the OAUTH_CLIENT_ID value

-- 4. Compute Pool for the SPCS service
--    STANDARD_2 (2 vCPU, 8GB RAM) is sufficient for the add-in server
CREATE COMPUTE POOL IF NOT EXISTS EXCEL_ADDIN_POOL
  MIN_NODES = 1
  MAX_NODES = 2
  INSTANCE_FAMILY = CPU_X64_S
  AUTO_RESUME = TRUE
  AUTO_SUSPEND_SECS = 300
  COMMENT = 'Compute pool for Snowflake Excel Add-in';

-- Wait for the pool to be IDLE before proceeding
SHOW COMPUTE POOLS LIKE 'EXCEL_ADDIN_POOL';

-- 5. Create the SPCS Service
--    Replace <ACCOUNT> with your account identifier
--    Replace <OAUTH_CLIENT_ID> with the value from step 4 above
CREATE SERVICE IF NOT EXISTS EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN
  IN COMPUTE POOL EXCEL_ADDIN_POOL
  FROM SPECIFICATION $$
    spec:
      containers:
        - name: addin
          image: /excel_addin_db/app/excel_addin_repo/snowflake-excel-addin:latest
          env:
            PORT: "3000"
            NODE_ENV: production
            OAUTH_CLIENT_ID: "<OAUTH_CLIENT_ID>"
            OAUTH_REDIRECT_URI: "https://<SPCS_ENDPOINT>/oauth/callback"
          readinessProbe:
            port: 3000
            path: /taskpane.html
          resources:
            requests:
              cpu: "0.5"
              memory: 512M
            limits:
              cpu: "1"
              memory: 1G
      endpoints:
        - name: ui
          port: 3000
          public: true
  $$
  MIN_INSTANCES = 1
  MAX_INSTANCES = 2
  COMMENT = 'Snowflake Excel Add-in served via SPCS';

-- 6. Check service status and get the public endpoint URL
SHOW SERVICES LIKE 'SNOWFLAKE_EXCEL_ADDIN' IN SCHEMA EXCEL_ADDIN_DB.APP;
CALL SYSTEM$GET_SERVICE_STATUS('EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN');

-- Get the public endpoint URL — use this in manifest.xml
SHOW ENDPOINTS IN SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN;
-- The ingress_url column gives you: <hash>-<account>.snowflakecomputing.app

-- 7. Grant users access to the service endpoint
--    Only users with this role can reach the add-in URL
GRANT SERVICE ROLE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN!ALL_ENDPOINTS_USAGE
  TO ROLE SYSADMIN;

-- Grant to a broader role for end users:
-- GRANT SERVICE ROLE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN!ALL_ENDPOINTS_USAGE
--   TO ROLE <YOUR_END_USER_ROLE>;

-- 8. Update the OAuth redirect URI once you have the endpoint URL
ALTER SECURITY INTEGRATION SNOWFLAKE_EXCEL_ADDIN
  SET OAUTH_REDIRECT_URI = 'https://<ACTUAL_SPCS_ENDPOINT>/oauth/callback';

-- ============================================================
-- Useful maintenance commands
-- ============================================================

-- View service logs
CALL SYSTEM$GET_SERVICE_LOGS('EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN', 0, 'addin', 100);

-- Suspend / resume service
ALTER SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN SUSPEND;
ALTER SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN RESUME;

-- Upgrade to a new image version
ALTER SERVICE EXCEL_ADDIN_DB.APP.SNOWFLAKE_EXCEL_ADDIN
  FROM SPECIFICATION $$
    spec:
      containers:
        - name: addin
          image: /excel_addin_db/app/excel_addin_repo/snowflake-excel-addin:v2
  $$;
