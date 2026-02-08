# Design Document: Forgot Password Feature

## Overview

The Forgot Password feature enables users to securely reset their passwords through an email-based verification workflow. The system uses short-lived, single-purpose JWT tokens to authorize password reset operations while preventing unauthorized access and email enumeration attacks.

### Key Design Principles

1. **Security First**: Password reset tokens have minimal privileges (only password reset API access)
2. **Email Enumeration Prevention**: Silent failure for non-existent email addresses
3. **Time-Limited Access**: Short-lived tokens with expiration
4. **User Experience**: Familiar UI patterns consistent with existing login page
5. **Email Delivery Reliability**: Use proven open-source email library with broad provider support

### Technology Stack

- **Backend**: Node.js with Express and TypeScript
- **Frontend**: React with TypeScript and Cloudscape Design System
- **Authentication**: JWT tokens (existing infrastructure)
- **Email Service**: Nodemailer (robust, well-maintained, supports major providers)
- **Database**: Prisma ORM (existing infrastructure)

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  LoginPage                                                       │
│  ├─ Email Input Field                                           │
│  ├─ Password Input Field                                        │
│  ├─ "Forgot Password" Link (conditional enable)                 │
│  └─ Confirmation Modal                                          │
│                                                                  │
│  PasswordResetPage (/login?password_reset=<token>)              │
│  ├─ Email Display (disabled)                                    │
│  ├─ New Password Input                                          │
│  └─ Confirm Password Input                                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (Express)                       │
├─────────────────────────────────────────────────────────────────┤
│  Auth Routes                                                     │
│  ├─ POST /api/auth/request-password-reset                       │
│  └─ POST /api/auth/reset-password                               │
│                                                                  │
│  Auth Service                                                    │
│  ├─ generatePasswordResetToken()                                │
│  ├─ validatePasswordResetToken()                                │
│  └─ resetPassword()                                             │
│                                                                  │
│  Email Service (NEW)                                             │
│  ├─ sendPasswordResetEmail()                                    │
│  └─ Email Templates                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Email Provider (SMTP)                       │
│  (Microsoft Exchange, Gmail, Yahoo, etc.)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Request Flow

#### Password Reset Request Flow

1. User enters email in login page
2. Frontend validates email format and enables "Forgot Password" link
3. User clicks link → Modal appears for confirmation
4. User confirms → Frontend calls `POST /api/auth/request-password-reset`
5. Backend checks if email exists in database
   - If exists: Generate token, send email
   - If not exists: Silent success (no error, no email)
6. Backend returns success response (same for both cases)
7. Frontend shows success message
8. User receives email with reset link

#### Password Reset Completion Flow

1. User clicks link in email → Opens `/login?password_reset=<token>`
2. Frontend extracts token from URL parameter
3. Frontend displays password reset form with email (derived from token)
4. User enters new password twice
5. Frontend validates passwords match
6. Frontend calls `POST /api/auth/reset-password` with token and new password
7. Backend validates token and updates password
8. Frontend redirects to login page with success message

## Components and Interfaces

### Frontend Components

#### LoginPage Component (Modified)

**Location**: `web-frontend/src/pages/LoginPage.tsx`

**New State Variables**:
```typescript
const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
const [isForgotPasswordEnabled, setIsForgotPasswordEnabled] = useState(false);
```

**New Functions**:
```typescript
// Enable/disable forgot password link based on email validation
useEffect(() => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  setIsForgotPasswordEnabled(emailRegex.test(email));
}, [email]);

// Handle forgot password link click
const handleForgotPasswordClick = () => {
  setShowForgotPasswordModal(true);
};

// Handle modal confirmation
const handleConfirmForgotPassword = async () => {
  try {
    await AuthService.requestPasswordReset(email);
    setShowForgotPasswordModal(false);
    // Show success message
  } catch (error) {
    // Handle error
  }
};
```

**UI Changes**:
- Add "Forgot Password" link below password field
- Link is disabled when email field is empty or invalid
- Link opens confirmation modal when clicked
- Modal uses Cloudscape Modal component with consistent branding

#### PasswordResetPage Component (New)

**Location**: `web-frontend/src/pages/PasswordResetPage.tsx`

**Purpose**: Display password reset form when user clicks email link

**State Variables**:
```typescript
const [token, setToken] = useState('');
const [email, setEmail] = useState('');
const [newPassword, setNewPassword] = useState('');
const [confirmPassword, setConfirmPassword] = useState('');
const [passwordError, setPasswordError] = useState('');
const [confirmPasswordError, setConfirmPasswordError] = useState('');
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState('');
```

**Key Functions**:
```typescript
// Extract token from URL and decode email
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('password_reset');
  if (resetToken) {
    setToken(resetToken);
    // Decode token to extract email (client-side decode, no verification)
    const decoded = decodeJWT(resetToken);
    setEmail(decoded.email);
  }
}, []);

// Validate passwords match
const validatePasswords = (): boolean => {
  if (newPassword !== confirmPassword) {
    setConfirmPasswordError('Passwords do not match');
    return false;
  }
  return true;
};

// Submit password reset
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  if (!validatePasswords()) return;
  
  try {
    await AuthService.resetPassword(token, newPassword);
    // Redirect to login with success message
    navigate('/login?reset_success=true');
  } catch (error) {
    setError('Failed to reset password. Link may be expired.');
  }
};
```

**UI Structure**:
- Reuses login page styling and layout
- Email field is disabled (display only)
- Two password input fields (new password, confirm password)
- Submit button
- Error messages for validation and API errors

### Backend Services

#### AuthService (Modified)

**Location**: `backend-api/src/services/auth.service.ts`

**New Methods**:

```typescript
/**
 * Generate a password reset token for the given email
 * Returns null if email doesn't exist (for silent failure)
 */
async requestPasswordReset(email: string): Promise<boolean> {
  const user = await this.userRepository.findByEmail(email);
  
  // Silent failure for non-existent emails (prevent enumeration)
  if (!user) {
    return true; // Return success without doing anything
  }
  
  // Generate short-lived token with minimal scope
  const resetToken = this.generatePasswordResetToken({
    email: user.email,
    userId: user.id,
    purpose: 'password_reset'
  });
  
  // Send email with reset link
  await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  
  return true;
}

/**
 * Generate a password reset token
 * Token expires in 15 minutes and has no API access except password reset
 */
generatePasswordResetToken(payload: PasswordResetTokenPayload): string {
  return jwt.sign(payload, this.JWT_SECRET, {
    expiresIn: '15m', // Short-lived token
  });
}

/**
 * Validate password reset token and update password
 */
async resetPassword(token: string, newPassword: string): Promise<void> {
  // Verify token
  let payload: PasswordResetTokenPayload;
  try {
    payload = this.verifyToken<PasswordResetTokenPayload>(token);
  } catch (error) {
    throw new Error('Invalid or expired reset token');
  }
  
  // Verify token purpose
  if (payload.purpose !== 'password_reset') {
    throw new Error('Invalid token type');
  }
  
  // Get user from token (not from request parameter)
  const user = await this.userRepository.findByEmail(payload.email);
  if (!user) {
    throw new Error('User not found');
  }
  
  // Hash new password
  const passwordHash = await this.hashPassword(newPassword);
  
  // Update password
  await this.userRepository.update(user.id, { passwordHash });
}
```

#### EmailService (New)

**Location**: `backend-api/src/services/email.service.ts`

**Purpose**: Handle all email sending operations using Nodemailer

**Configuration**:
```typescript
export class EmailService {
  private transporter: nodemailer.Transporter;
  
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }
  
  /**
   * Send password reset email with token link
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/login?password_reset=${token}`;
    
    const mailOptions = {
      from: process.env.SMTP_FROM_ADDRESS,
      to: email,
      subject: 'Password Reset Request',
      html: this.getPasswordResetEmailTemplate(resetUrl),
      text: this.getPasswordResetEmailTextTemplate(resetUrl),
    };
    
    await this.transporter.sendMail(mailOptions);
  }
  
  /**
   * HTML email template for password reset
   */
  private getPasswordResetEmailTemplate(resetUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to proceed:</p>
        <p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0972D3; color: white; text-decoration: none; border-radius: 4px;">
            Reset Password
          </a>
        </p>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this password reset, you can safely ignore this email.</p>
      </div>
    `;
  }
  
  /**
   * Plain text email template for password reset
   */
  private getPasswordResetEmailTextTemplate(resetUrl: string): string {
    return `
Password Reset Request

You requested to reset your password. Click the link below to proceed:

${resetUrl}

This link will expire in 15 minutes.

If you didn't request this password reset, you can safely ignore this email.
    `;
  }
}
```

**Environment Variables Required**:
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP server port (default: 587)
- `SMTP_SECURE`: Use TLS (true for port 465)
- `SMTP_USER`: SMTP authentication username
- `SMTP_PASSWORD`: SMTP authentication password
- `SMTP_FROM_ADDRESS`: Sender email address
- `FRONTEND_URL`: Frontend base URL for reset links

### Backend Routes

#### Auth Routes (Modified)

**Location**: `backend-api/src/routes/auth.routes.ts`

**New Routes**:

```typescript
// POST /api/auth/request-password-reset
this.router.post(
  '/request-password-reset',
  ValidationMiddleware.validateBody(RequestPasswordResetSchema),
  this.requestPasswordReset.bind(this)
);

// POST /api/auth/reset-password
this.router.post(
  '/reset-password',
  ValidationMiddleware.validateBody(ResetPasswordSchema),
  this.resetPassword.bind(this)
);
```

**Route Handlers**:

```typescript
/**
 * POST /api/auth/request-password-reset
 * Request a password reset email
 */
private async requestPasswordReset(req: Request, res: Response) {
  try {
    const { email } = req.body;
    await this.authService.requestPasswordReset(email);
    
    // Always return success (even if email doesn't exist)
    res.status(200).json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.',
    });
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while processing your request',
      details: {},
    });
  }
}

/**
 * POST /api/auth/reset-password
 * Reset password using token
 */
private async resetPassword(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;
    await this.authService.resetPassword(token, newPassword);
    
    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid or expired')) {
      return res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired reset token',
        details: {},
      });
    }
    
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'An error occurred while resetting your password',
      details: {},
    });
  }
}
```

### Backend Middleware

#### Auth Middleware (Modified)

**Location**: `backend-api/src/middleware/auth.middleware.ts`

**Purpose**: Ensure password reset tokens cannot access other APIs

**Modification**:

```typescript
authenticate() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const token = this.extractToken(req);
      if (!token) {
        return res.status(401).json({
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided',
          details: {},
        });
      }

      const payload = this.authService.validateAccessToken(token);
      
      // CRITICAL: Reject password reset tokens for regular API access
      if ('purpose' in payload && payload.purpose === 'password_reset') {
        return res.status(403).json({
          code: 'FORBIDDEN',
          message: 'Password reset tokens cannot be used for API access',
          details: {},
        });
      }
      
      req.user = payload;
      next();
    } catch (error) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        details: {},
      });
    }
  };
}
```

## Data Models

### TypeScript Types

#### Password Reset Token Payload

**Location**: `backend-api/src/types/auth.types.ts`

```typescript
export interface PasswordResetTokenPayload {
  email: string;
  userId: string;
  purpose: 'password_reset';
  iat?: number; // Issued at (added by JWT)
  exp?: number; // Expiration (added by JWT)
}
```

#### Request/Response Schemas

**Location**: `backend-api/src/utils/validation.schemas.ts`

```typescript
import { z } from 'zod';

export const RequestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
```

### Frontend Service Types

**Location**: `web-frontend/src/services/api/auth.service.ts`

```typescript
export interface RequestPasswordResetRequest {
  email: string;
}

export interface RequestPasswordResetResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}
```

### Database Schema

No database schema changes required. The feature uses existing User table and JWT tokens for authorization.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Forgot Password Link State

*For any* email input value, the "Forgot Password" link should be enabled if and only if the value is a valid email address format.

**Validates: Requirements 1.2, 1.3**

### Property 2: Modal Displays Correct Email

*For any* valid email address entered in the username field, when the forgot password modal is opened, the modal should display that exact email address.

**Validates: Requirements 2.1**

### Property 3: API Call on Confirmation

*For any* email address, when the user confirms the password reset in the modal, the frontend should call the backend API exactly once with that email address.

**Validates: Requirements 2.4**

### Property 4: Token Generation for Existing Users

*For any* email address that exists in the user database, when a password reset is requested, the backend should generate a password reset token.

**Validates: Requirements 3.1**

### Property 5: Silent Failure for Non-Existent Users

*For any* email address that does not exist in the user database, when a password reset is requested, the backend should not generate a token, should not send an email, and should return a success response.

**Validates: Requirements 3.2**

### Property 6: Token Structure and Properties

*For any* generated password reset token, the token should:
- Have an expiration time of 15 minutes or less
- Embed the target email address in the payload
- Include a purpose field set to 'password_reset'
- Be formatted as a valid JWT

**Validates: Requirements 3.3, 3.4, 3.6**

### Property 7: Token Authorization Restriction

*For any* password reset token, when used to authenticate API requests to non-password-reset endpoints, the request should be rejected with a 403 Forbidden error.

**Validates: Requirements 3.5**

### Property 8: Email Content Completeness

*For any* password reset email sent, the email should contain:
- A URL with the embedded password reset token
- Instructions for completing the password reset
- An expiration notice

**Validates: Requirements 4.2, 4.3**

### Property 9: Email Display on Reset Page

*For any* valid password reset token in the URL parameter, the reset page should display the email address from the token in a disabled input field.

**Validates: Requirements 5.3**

### Property 10: Password Matching Validation

*For any* pair of password inputs, the form submission should be enabled if and only if both passwords are non-empty and match exactly.

**Validates: Requirements 6.1, 6.2, 6.3**

### Property 11: Confirmation Password Exclusion

*For any* password reset form submission, the API request payload should contain the new password and token, but should not contain the confirmation password field.

**Validates: Requirements 6.4**

### Property 12: Token Validation and Email Derivation

*For any* password reset request, the backend should:
- Validate the token signature and expiration
- Reject invalid or expired tokens with an error
- Derive the target email address from the token payload (not from request parameters)
- Ignore any email address provided in the request body

**Validates: Requirements 7.2, 7.3, 7.4, 7.6**

### Property 13: Password Update on Valid Token

*For any* valid password reset token and new password, when the password reset API is called, the password for the user associated with the token's email should be updated to the new password.

**Validates: Requirements 7.5**

## Error Handling

### Frontend Error Handling

#### Login Page Errors

1. **Invalid Email Format**: Display inline error message when email format is invalid
2. **API Request Failure**: Display error alert if password reset request fails
3. **Network Errors**: Display user-friendly message for network connectivity issues

#### Password Reset Page Errors

1. **Invalid/Expired Token**: Display error message and provide link back to login page
2. **Password Mismatch**: Display inline error message below confirmation field
3. **Weak Password**: Display inline error message if password doesn't meet requirements
4. **API Request Failure**: Display error alert if password reset fails
5. **Missing Token**: Redirect to login page if no token in URL

### Backend Error Handling

#### Request Password Reset Endpoint

1. **Invalid Email Format**: Return 400 Bad Request with validation error
2. **Email Service Failure**: Log error but return success to user (prevent enumeration)
3. **Database Errors**: Return 500 Internal Server Error

#### Reset Password Endpoint

1. **Missing Token**: Return 400 Bad Request
2. **Invalid Token Signature**: Return 401 Unauthorized
3. **Expired Token**: Return 401 Unauthorized with specific message
4. **Wrong Token Purpose**: Return 403 Forbidden
5. **User Not Found**: Return 404 Not Found (should not happen if token is valid)
6. **Weak Password**: Return 400 Bad Request with validation error
7. **Database Errors**: Return 500 Internal Server Error

### Error Response Format

All backend errors follow the existing error response format:

```typescript
{
  code: string;        // Error code (e.g., 'INVALID_TOKEN')
  message: string;     // User-friendly error message
  details: object;     // Additional error details
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs
- Together they provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness

### Property-Based Testing

**Library**: fast-check (already in dependencies for frontend)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: forgot-password, Property {N}: {property description}`

**Property Test Coverage**:

Each correctness property listed above must be implemented as a property-based test:

1. **Property 1**: Generate random valid and invalid email strings, verify link state
2. **Property 2**: Generate random valid emails, verify modal displays correct email
3. **Property 3**: Generate random emails, verify API call with correct parameters
4. **Property 4**: Generate random existing users, verify token generation
5. **Property 5**: Generate random non-existent emails, verify silent failure
6. **Property 6**: Generate random tokens, verify structure and expiration
7. **Property 7**: Generate random reset tokens, attempt API calls, verify rejection
8. **Property 8**: Generate random reset requests, verify email content
9. **Property 9**: Generate random tokens, verify email display on reset page
10. **Property 10**: Generate random password pairs, verify validation logic
11. **Property 11**: Generate random form submissions, verify API payload
12. **Property 12**: Generate random tokens (valid/invalid/expired), verify validation
13. **Property 13**: Generate random users and passwords, verify password update

### Unit Testing

**Frontend Unit Tests**:

1. **LoginPage Component**:
   - Forgot password link is present
   - Link is disabled by default
   - Modal opens when link is clicked
   - Modal closes on cancel
   - Success message displays after confirmation

2. **PasswordResetPage Component**:
   - Email field is disabled
   - Password fields are present
   - Error message displays for mismatched passwords
   - Form submits with valid inputs
   - Redirects to login on success

**Backend Unit Tests**:

1. **AuthService**:
   - `requestPasswordReset()` returns success for any email
   - `generatePasswordResetToken()` creates valid JWT
   - `resetPassword()` updates password with valid token
   - `resetPassword()` rejects invalid tokens

2. **EmailService**:
   - `sendPasswordResetEmail()` calls transporter with correct parameters
   - Email template includes reset URL
   - Email template includes instructions

3. **Auth Routes**:
   - POST /api/auth/request-password-reset returns 200
   - POST /api/auth/reset-password returns 200 with valid token
   - POST /api/auth/reset-password returns 401 with invalid token

4. **Auth Middleware**:
   - Password reset tokens are rejected for regular API endpoints
   - Regular access tokens work normally

### Integration Testing

1. **End-to-End Flow**:
   - Request password reset → Receive email → Click link → Reset password → Login with new password

2. **Email Delivery**:
   - Test with actual SMTP server (staging environment)
   - Verify email formatting and deliverability

3. **Token Expiration**:
   - Verify expired tokens are rejected
   - Verify tokens expire after 15 minutes

### Edge Cases and Error Conditions

1. **Empty email field**: Link should be disabled
2. **Malformed email**: Link should be disabled
3. **Very long email**: Should be handled gracefully
4. **Special characters in password**: Should be accepted
5. **Token tampering**: Should be rejected
6. **Expired token**: Should return clear error message
7. **Token reuse**: Should work (tokens are single-use by nature of password change)
8. **Concurrent reset requests**: Each should generate unique token
9. **Email service down**: Should log error but not expose to user
10. **Database connection failure**: Should return 500 error

### Security Testing

1. **Email Enumeration Prevention**: Verify same response for existing/non-existing emails
2. **Token Privilege Escalation**: Verify reset tokens cannot access other APIs
3. **Token Expiration**: Verify tokens expire after 15 minutes
4. **Email Derivation**: Verify email is derived from token, not request parameter
5. **Password Hashing**: Verify new passwords are properly hashed before storage

## Implementation Notes

### Nodemailer Configuration

Nodemailer supports multiple transport methods and mail providers:

**SMTP Configuration** (recommended for production):
```typescript
{
  host: 'smtp.example.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'username',
    pass: 'password'
  }
}
```

**Provider-Specific Examples**:

- **Gmail**: Use App Passwords, port 587 with STARTTLS
- **Microsoft Exchange**: Use Office 365 SMTP settings
- **Yahoo**: Use App Passwords, port 587
- **SendGrid**: Use API key as password
- **AWS SES**: Use SMTP credentials from IAM

### Environment Variables

Add to `.env` file:

```bash
# Email Service Configuration
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_ADDRESS=noreply@example.com

# Frontend URL for reset links
FRONTEND_URL=https://your-app.com
```

### Security Considerations

1. **Token Expiration**: 15-minute expiration balances security and usability
2. **Email Enumeration**: Always return success to prevent user enumeration
3. **Token Scope**: Reset tokens have minimal privileges (only password reset)
4. **HTTPS Required**: Password reset links must use HTTPS in production
5. **Rate Limiting**: Consider adding rate limiting to prevent abuse
6. **Password Requirements**: Enforce minimum password strength requirements
7. **Audit Logging**: Log password reset requests and completions

### Future Enhancements

1. **Rate Limiting**: Add rate limiting to password reset requests per email/IP
2. **Multi-Factor Authentication**: Require additional verification for sensitive accounts
3. **Password History**: Prevent reuse of recent passwords
4. **Account Lockout**: Lock account after multiple failed reset attempts
5. **Email Verification**: Require email verification before allowing password reset
6. **Notification Email**: Send notification to user when password is changed
7. **Token Revocation**: Invalidate token after successful password reset
