# Implementation Plan: Forgot Password Feature

## Overview

This implementation plan breaks down the Forgot Password feature into discrete coding tasks. The approach follows a bottom-up strategy: first implementing backend services and APIs, then frontend components, and finally integration and testing. Each task builds on previous work to ensure incremental progress and early validation.

## Tasks

- [x] 1. Set up email service infrastructure
  - [x] 1.1 Install Nodemailer dependency and type definitions
    - Run `npm install nodemailer @types/nodemailer` in backend-api directory
    - _Requirements: 4.4_
  
  - [x] 1.2 Create EmailService class with SMTP configuration
    - Create `backend-api/src/services/email.service.ts`
    - Implement constructor with Nodemailer transporter configuration
    - Read SMTP settings from environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_ADDRESS)
    - _Requirements: 4.4, 4.5, 4.6_
  
  - [x] 1.3 Implement sendPasswordResetEmail method
    - Create method that accepts email and token parameters
    - Build reset URL using FRONTEND_URL environment variable and token
    - Create HTML and plain text email templates
    - Call transporter.sendMail with proper mail options
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ]* 1.4 Write property test for email content
    - **Property 8: Email Content Completeness**
    - **Validates: Requirements 4.2, 4.3**
    - Generate random tokens and emails
    - Mock transporter.sendMail to capture email content
    - Verify email contains reset URL with token, instructions, and expiration notice
  
  - [x] 1.5 Write unit tests for EmailService
    - Test constructor reads environment variables correctly
    - Test sendPasswordResetEmail calls transporter with correct parameters
    - Test email templates include required content
    - _Requirements: 4.6_

- [x] 2. Extend authentication service for password reset
  - [x] 2.1 Add PasswordResetTokenPayload type to auth types
    - Edit `backend-api/src/types/auth.types.ts`
    - Add interface with email, userId, and purpose fields
    - _Requirements: 3.3, 3.4_
  
  - [x] 2.2 Implement generatePasswordResetToken method in AuthService
    - Edit `backend-api/src/services/auth.service.ts`
    - Create method that generates JWT with 15-minute expiration
    - Include email, userId, and purpose='password_reset' in payload
    - _Requirements: 3.1, 3.3, 3.4_
  
  - [ ]* 2.3 Write property test for token structure
    - **Property 6: Token Structure and Properties**
    - **Validates: Requirements 3.3, 3.4, 3.6**
    - Generate random user data
    - Create tokens and decode them
    - Verify expiration is 15 minutes or less, email is embedded, purpose is set, format is valid JWT
  
  - [x] 2.4 Implement requestPasswordReset method in AuthService
    - Add method that accepts email parameter
    - Check if user exists in database using userRepository.findByEmail
    - If user exists: generate token and call emailService.sendPasswordResetEmail
    - If user doesn't exist: return success without action (silent failure)
    - Always return true
    - _Requirements: 3.1, 3.2, 4.1_
  
  - [ ]* 2.5 Write property tests for password reset request
    - **Property 4: Token Generation for Existing Users**
    - **Validates: Requirements 3.1**
    - Generate random existing users, request resets, verify tokens are generated
    
    - **Property 5: Silent Failure for Non-Existent Users**
    - **Validates: Requirements 3.2**
    - Generate random non-existent emails, request resets, verify no token generated and no email sent
  
  - [x] 2.6 Implement resetPassword method in AuthService
    - Add method that accepts token and newPassword parameters
    - Verify token using verifyToken method
    - Check token purpose is 'password_reset'
    - Extract email from token payload (not from request)
    - Find user by email from token
    - Hash new password using hashPassword method
    - Update user password in database
    - Throw errors for invalid/expired tokens
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6_
  
  - [ ]* 2.7 Write property tests for password reset completion
    - **Property 12: Token Validation and Email Derivation**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.6**
    - Generate valid, invalid, and expired tokens
    - Verify validation logic, rejection of invalid tokens, email derivation from token
    
    - **Property 13: Password Update on Valid Token**
    - **Validates: Requirements 7.5**
    - Generate random users and passwords, reset passwords, verify updates

- [x] 3. Add validation schemas for password reset endpoints
  - [x] 3.1 Create validation schemas
    - Edit `backend-api/src/utils/validation.schemas.ts`
    - Add RequestPasswordResetSchema (email field with email validation)
    - Add ResetPasswordSchema (token and newPassword fields with minimum length)
    - _Requirements: 1.2, 7.1_
  
  - [x] 3.2 Write unit tests for validation schemas
    - Test RequestPasswordResetSchema accepts valid emails and rejects invalid
    - Test ResetPasswordSchema requires token and enforces password minimum length

- [x] 4. Implement password reset API routes
  - [x] 4.1 Add password reset routes to AuthRoutes
    - Edit `backend-api/src/routes/auth.routes.ts`
    - Add POST /api/auth/request-password-reset route with validation middleware
    - Add POST /api/auth/reset-password route with validation middleware
    - _Requirements: 3.1, 7.1_
  
  - [x] 4.2 Implement requestPasswordReset route handler
    - Extract email from request body
    - Call authService.requestPasswordReset
    - Always return 200 success with generic message
    - Handle errors with 500 response
    - _Requirements: 3.1, 3.2_
  
  - [x] 4.3 Implement resetPassword route handler
    - Extract token and newPassword from request body
    - Call authService.resetPassword
    - Return 200 success on completion
    - Return 401 for invalid/expired tokens
    - Handle errors with 500 response
    - _Requirements: 7.2, 7.3, 7.5_
  
  - [ ]* 4.4 Write integration tests for password reset routes
    - Test POST /api/auth/request-password-reset returns 200 for any email
    - Test POST /api/auth/reset-password returns 200 with valid token
    - Test POST /api/auth/reset-password returns 401 with invalid token
    - Test POST /api/auth/reset-password returns 401 with expired token

- [x] 5. Enhance auth middleware to block password reset tokens
  - [x] 5.1 Modify authenticate middleware to check token purpose
    - Edit `backend-api/src/middleware/auth.middleware.ts`
    - After validating token, check if payload contains purpose='password_reset'
    - If password reset token, return 403 Forbidden error
    - Allow regular tokens to proceed normally
    - _Requirements: 3.5_
  
  - [ ]* 5.2 Write property test for token authorization restriction
    - **Property 7: Token Authorization Restriction**
    - **Validates: Requirements 3.5**
    - Generate password reset tokens
    - Attempt to call various protected API endpoints
    - Verify all requests are rejected with 403 Forbidden

- [x] 6. Checkpoint - Backend implementation complete
  - Ensure all backend tests pass
  - Verify email service can connect to SMTP server (manual test with test credentials)
  - Ask the user if questions arise

- [x] 7. Create frontend auth service methods for password reset
  - [x] 7.1 Add password reset types to auth service
    - Edit `web-frontend/src/services/api/auth.service.ts`
    - Add RequestPasswordResetRequest, RequestPasswordResetResponse interfaces
    - Add ResetPasswordRequest, ResetPasswordResponse interfaces
    - _Requirements: 1.4, 7.1_
  
  - [x] 7.2 Implement requestPasswordReset method
    - Add method that calls POST /api/auth/request-password-reset
    - Accept email parameter
    - Return response with success and message
    - _Requirements: 2.4_
  
  - [x] 7.3 Implement resetPassword method
    - Add method that calls POST /api/auth/reset-password
    - Accept token and newPassword parameters
    - Return response with success and message
    - _Requirements: 7.1_
  
  - [x] 7.4 Write unit tests for auth service methods
    - Test requestPasswordReset calls correct endpoint with email
    - Test resetPassword calls correct endpoint with token and password
    - Test error handling for failed requests

- [x] 8. Modify LoginPage component to add forgot password link
  - [x] 8.1 Add state variables for forgot password functionality
    - Edit `web-frontend/src/pages/LoginPage.tsx`
    - Add showForgotPasswordModal state (boolean)
    - Add isForgotPasswordEnabled state (boolean)
    - _Requirements: 1.1, 1.2_
  
  - [x] 8.2 Implement email validation effect for link enablement
    - Add useEffect that watches email field
    - Validate email format using regex
    - Update isForgotPasswordEnabled based on validation
    - _Requirements: 1.2, 1.3_
  
  - [ ]* 8.3 Write property test for link state
    - **Property 1: Forgot Password Link State**
    - **Validates: Requirements 1.2, 1.3**
    - Generate random valid and invalid email strings
    - Render component with each email
    - Verify link is enabled only for valid emails
  
  - [x] 8.4 Add forgot password link to UI
    - Add Link component below password field
    - Set disabled prop based on isForgotPasswordEnabled
    - Add onClick handler to open modal
    - Style consistently with existing UI
    - _Requirements: 1.1, 1.4_
  
  - [x] 8.5 Write unit test for forgot password link presence
    - Test link is rendered on login page
    - Test link is disabled by default
    - _Requirements: 1.1_

- [x] 9. Implement forgot password confirmation modal
  - [x] 9.1 Add Modal component to LoginPage
    - Import Modal component from Cloudscape Design
    - Add modal with header "Confirm Password Reset"
    - Display email address in modal content
    - Add Cancel and Confirm buttons
    - Use same styling as navigation confirmation modals
    - _Requirements: 1.4, 2.1, 2.2, 2.3_
  
  - [ ]* 9.2 Write property test for modal email display
    - **Property 2: Modal Displays Correct Email**
    - **Validates: Requirements 2.1**
    - Generate random valid emails
    - Open modal with each email
    - Verify modal displays the correct email
  
  - [x] 9.3 Implement modal confirmation handler
    - Add handleConfirmForgotPassword function
    - Call AuthService.requestPasswordReset with email
    - Close modal on success
    - Display success message
    - Handle errors appropriately
    - _Requirements: 2.4_
  
  - [ ]* 9.4 Write property test for API call on confirmation
    - **Property 3: API Call on Confirmation**
    - **Validates: Requirements 2.4**
    - Generate random emails
    - Mock API call
    - Simulate confirmation
    - Verify API is called exactly once with correct email
  
  - [x] 9.5 Implement modal cancel handler
    - Add handleCancelForgotPassword function
    - Close modal without making API call
    - _Requirements: 2.5_
  
  - [x] 9.6 Write unit test for modal cancel
    - Test modal closes on cancel
    - Test no API call is made on cancel
    - _Requirements: 2.5_

- [x] 10. Create PasswordResetPage component
  - [x] 10.1 Create new page component file
    - Create `web-frontend/src/pages/PasswordResetPage.tsx`
    - Set up component structure similar to LoginPage
    - Use same Container and Form components
    - _Requirements: 5.1, 5.2_
  
  - [x] 10.2 Add state variables for password reset form
    - Add token, email, newPassword, confirmPassword states
    - Add error states for validation
    - Add isLoading state
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [x] 10.3 Implement token extraction and email display
    - Add useEffect to extract password_reset parameter from URL
    - Decode JWT token to extract email (client-side, no verification)
    - Set email state from decoded token
    - _Requirements: 5.1, 5.3_
  
  - [ ]* 10.4 Write property test for email display
    - **Property 9: Email Display on Reset Page**
    - **Validates: Requirements 5.3**
    - Generate random tokens with embedded emails
    - Render page with each token
    - Verify email is displayed in disabled field
  
  - [x] 10.5 Add form fields to UI
    - Add disabled Input for email display
    - Add Input for new password (type="password")
    - Add Input for confirm password (type="password")
    - Add Submit button
    - Style consistently with LoginPage
    - _Requirements: 5.3, 5.4, 5.5_
  
  - [x] 10.6 Write unit tests for form fields
    - Test email field is present and disabled
    - Test new password field is present
    - Test confirm password field is present
    - _Requirements: 5.4, 5.5_

- [x] 11. Implement password validation and form submission
  - [x] 11.1 Add password matching validation
    - Create validatePasswords function
    - Check if both passwords are non-empty and match
    - Set error message if validation fails
    - _Requirements: 6.1, 6.2_
  
  - [ ]* 11.2 Write property test for password validation
    - **Property 10: Password Matching Validation**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Generate random password pairs (matching and non-matching)
    - Test validation logic
    - Verify form submission state based on validation
  
  - [x] 11.3 Implement form submission handler
    - Create handleSubmit function
    - Validate passwords match before submission
    - Call AuthService.resetPassword with token and newPassword only
    - Do NOT include confirmPassword in API call
    - Redirect to login page on success
    - Display error message on failure
    - _Requirements: 6.3, 6.4, 7.1_
  
  - [ ]* 11.4 Write property test for confirmation password exclusion
    - **Property 11: Confirmation Password Exclusion**
    - **Validates: Requirements 6.4**
    - Generate random form submissions
    - Mock API call and capture payload
    - Verify confirmPassword is not in payload
  
  - [x] 11.5 Write unit tests for form submission
    - Test form submits with matching passwords
    - Test form prevents submission with mismatched passwords
    - Test error message displays for mismatched passwords
    - Test redirect to login on success
    - _Requirements: 6.2, 6.3_

- [x] 12. Add routing for password reset page
  - [x] 12.1 Update router configuration
    - Edit router configuration file (likely `web-frontend/src/App.tsx` or routes file)
    - Ensure /login route can handle password_reset query parameter
    - Conditionally render PasswordResetPage when parameter is present
    - Otherwise render LoginPage
    - _Requirements: 5.1_
  
  - [x] 12.2 Write unit test for routing
    - Test /login route renders LoginPage by default
    - Test /login?password_reset=token renders PasswordResetPage
    - _Requirements: 5.1_

- [x] 13. Add environment variables and configuration
  - [x] 13.1 Update backend .env.example file
    - Add SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_ADDRESS
    - Add FRONTEND_URL
    - Document each variable with comments
    - _Requirements: 4.6_
  
  - [x] 13.2 Update backend configuration documentation
    - Document email service setup in README or docs
    - Provide examples for common email providers (Gmail, Exchange, Yahoo)
    - Include security notes about app passwords
    - _Requirements: 4.5_

- [x] 14. Final checkpoint - Integration and testing
  - [x] 14.1 Test complete end-to-end flow
    - Manually test: request reset → receive email → click link → reset password → login
    - Verify email delivery works with configured SMTP server
    - Test with both existing and non-existing email addresses
    - _Requirements: All_
  
  - [x] 14.2 Test error scenarios
    - Test with expired token
    - Test with invalid token
    - Test with mismatched passwords
    - Test with weak passwords
    - Test email service failure handling
    - _Requirements: 7.3_
  
  - [x] 14.3 Security verification
    - Verify password reset tokens cannot access other APIs
    - Verify email enumeration prevention (same response for existing/non-existing)
    - Verify token expiration works correctly
    - Verify email is derived from token, not request parameter
    - _Requirements: 3.2, 3.5, 7.4, 7.6_
  
  - [x] 14.4 Ensure all tests pass
    - Run all unit tests
    - Run all property-based tests
    - Verify test coverage meets requirements
    - Ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: backend services → API routes → frontend components → integration
