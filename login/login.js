// Application data from the provided JSON
const appData = {
    college: {
        name: "Kumaraguru College of Liberal Arts & Science",
        shortName: "KCLAS",
        address: "Coimbatore, Tamil Nadu, India",
        website: "www.kclas.ac.in",
        email: "info@kclas.ac.in"
    },
    authenticationRequirements: {
        emailValidation: {
            required: true,
            format: "standard email format",
            domains: ["kclas.ac.in", "gmail.com", "yahoo.com", "outlook.com"]
        },
        passwordRequirements: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true,
            maxLength: 128
        }
    },
    userRoles: [
        {
            role: "Faculty",
            permissions: ["create_questions", "manage_papers", "view_reports"]
        },
        {
            role: "Admin",
            permissions: ["full_access", "manage_users", "system_settings"]
        },
        {
            role: "Staff",
            permissions: ["view_questions", "generate_papers"]
        }
    ],
    formMessages: {
        login: {
            welcome: "Welcome back to KCLAS",
            subtitle: "Sign in to access the Question Paper Generator",
            emailPlaceholder: "Enter your email address",
            passwordPlaceholder: "Enter your password",
            loginButton: "Sign In",
            forgotPassword: "Forgot your password?",
            rememberMe: "Remember me"
        },
        forgotPassword: {
            title: "Reset your password",
            subtitle: "Enter your email address and we'll send you a link to reset your password",
            emailPlaceholder: "Enter your email address",
            sendButton: "Send Reset Link",
            backToLogin: "Back to Login",
            successMessage: "Password reset link has been sent to your email address"
        },
        resetPassword: {
            title: "Create new password",
            subtitle: "Your new password must be different from previously used passwords",
            newPasswordPlaceholder: "Enter new password",
            confirmPasswordPlaceholder: "Confirm new password",
            resetButton: "Reset Password",
            strengthLabel: "Password strength:",
            requirements: [
                "At least 8 characters long",
                "Contains uppercase and lowercase letters",
                "Contains at least one number",
                "Contains at least one special character"
            ],
            successMessage: "Password has been reset successfully"
        },
        validation: {
            emailRequired: "Email address is required",
            emailInvalid: "Please enter a valid email address",
            passwordRequired: "Password is required",
            passwordTooShort: "Password must be at least 8 characters",
            passwordsNoMatch: "Passwords do not match",
            loginFailed: "Invalid email or password",
            networkError: "Network error. Please try again."
        }
    }
};

// Global variables
let currentPage = 'loginPage';
let passwordStrengthScore = 0;
let isNavigating = false;

// DOM elements
const elements = {
    // Pages
    loginPage: document.getElementById('loginPage'),
    forgotPasswordPage: document.getElementById('forgotPasswordPage'),
    resetPasswordPage: document.getElementById('resetPasswordPage'),
    
    // Login form
    loginForm: document.getElementById('loginForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    passwordToggle: document.getElementById('passwordToggle'),
    rememberMe: document.getElementById('rememberMe'),
    forgotPasswordLink: document.getElementById('forgotPasswordLink'),
    
    // Forgot password form
    forgotPasswordForm: document.getElementById('forgotPasswordForm'),
    forgotEmail: document.getElementById('forgotEmail'),
    forgotSuccessMessage: document.getElementById('forgotSuccessMessage'),
    backToLogin: document.getElementById('backToLogin'),
    
    // Reset password form
    resetPasswordForm: document.getElementById('resetPasswordForm'),
    newPassword: document.getElementById('newPassword'),
    confirmPassword: document.getElementById('confirmPassword'),
    newPasswordToggle: document.getElementById('newPasswordToggle'),
    confirmPasswordToggle: document.getElementById('confirmPasswordToggle'),
    resetSuccessMessage: document.getElementById('resetSuccessMessage'),
    
    // Password strength
    strengthProgress: document.getElementById('strengthProgress'),
    strengthText: document.getElementById('strengthText'),
    
    // Password requirements
    reqLength: document.getElementById('req-length'),
    reqUpper: document.getElementById('req-upper'),
    reqNumber: document.getElementById('req-number'),
    reqSpecial: document.getElementById('req-special'),
    
    // Error messages
    emailError: document.getElementById('emailError'),
    passwordError: document.getElementById('passwordError'),
    forgotEmailError: document.getElementById('forgotEmailError'),
    newPasswordError: document.getElementById('newPasswordError'),
    confirmPasswordError: document.getElementById('confirmPasswordError'), 
    
    // Toast container
    toastContainer: document.getElementById('toastContainer')
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
});

/**
 * Toggles the visibility of a loader element within a given form.
 * @param {HTMLElement} form - The form element containing the loader.
 * @param {boolean} show - True to show the loader, false to hide it.
 */
function showLoader(form, show) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
        if (show) {
            submitButton.classList.add('loading');
            submitButton.setAttribute('disabled', 'true');
        } else {
            submitButton.classList.remove('loading');
            submitButton.removeAttribute('disabled');
        }
    }
}

/**
 * Displays a toast message to the user.
 * @param {string} message - The message to display.
 * @param {string} type - The type of toast (e.g., 'success', 'error', 'info').
 */
function showToast(message, type = 'info') {
    if (!elements.toastContainer) {
        console.warn('Toast container not found');
        return;
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    elements.toastContainer.appendChild(toast);

    // Automatically remove the toast after a few seconds
    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

function initializeApp() {
    // Show login page by default
    showPage('loginPage');
    
    // Add smooth transitions
    document.body.style.opacity = '0';
    setTimeout(() => {
        document.body.style.transition = 'opacity 0.5s ease';
        document.body.style.opacity = '1';
    }, 100);
}

function setupEventListeners() {
    // Navigation - Fixed to prevent multiple event bindings
    if (elements.forgotPasswordLink) {
        elements.forgotPasswordLink.addEventListener('click', handleForgotPasswordClick);
    }
    
    if (elements.backToLogin) {
        elements.backToLogin.addEventListener('click', handleBackToLoginClick);
    }
    
    // Form submissions
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', handleLogin);
    }
    if (elements.forgotPasswordForm) {
        elements.forgotPasswordForm.addEventListener('submit', handleForgotPassword);
    }
    if (elements.resetPasswordForm) {
        elements.resetPasswordForm.addEventListener('submit', handleResetPassword);
    }
    
    // Password toggles
    if (elements.passwordToggle) {
        elements.passwordToggle.addEventListener('click', () => togglePassword('loginPassword', 'passwordToggle'));
    }
    if (elements.newPasswordToggle) {
        elements.newPasswordToggle.addEventListener('click', () => togglePassword('newPassword', 'newPasswordToggle'));
    }
    if (elements.confirmPasswordToggle) {
        elements.confirmPasswordToggle.addEventListener('click', () => togglePassword('confirmPassword', 'confirmPasswordToggle'));
    }
    
    // Password strength checking
    if (elements.newPassword) {
        elements.newPassword.addEventListener('input', checkPasswordStrength);
    }
    if (elements.confirmPassword) {
        elements.confirmPassword.addEventListener('input', checkPasswordMatch);
    }
    
    // Real-time validation
    if (elements.loginEmail) {
        elements.loginEmail.addEventListener('blur', () => validateEmail(elements.loginEmail, elements.emailError));
        elements.loginEmail.addEventListener('input', () => clearError(elements.emailError));
    }
    if (elements.forgotEmail) {
        elements.forgotEmail.addEventListener('blur', () => validateEmail(elements.forgotEmail, elements.forgotEmailError));
        elements.forgotEmail.addEventListener('input', () => clearError(elements.forgotEmailError));
    }
    if (elements.loginPassword) {
        elements.loginPassword.addEventListener('blur', () => validatePassword(elements.loginPassword, elements.passwordError));
        elements.loginPassword.addEventListener('input', () => clearError(elements.passwordError));
    }
    
    // Clear errors on input
    if (elements.newPassword) {
        elements.newPassword.addEventListener('input', () => clearError(elements.newPasswordError));
    }
    if (elements.confirmPassword) {
        elements.confirmPassword.addEventListener('input', () => clearError(elements.confirmPasswordError));
    }
}

// Fixed navigation handlers
function handleForgotPasswordClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isNavigating) {
        showPage('forgotPasswordPage');
    }
}

function handleBackToLoginClick(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!isNavigating) {
        showPage('loginPage');
    }
}

// Enhanced page navigation with navigation lock
function showPage(pageId) {
    if (isNavigating) return;
    
    isNavigating = true;
    
    // Get all page elements
    const pages = ['loginPage', 'forgotPasswordPage', 'resetPasswordPage'];
    
    // Hide all pages immediately
    pages.forEach(id => {
        const page = document.getElementById(id);
        if (page) {
            page.classList.remove('active');
        }
    });
    
    // Show target page with animation
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        currentPage = pageId;
        
        // Reset page styles
        targetPage.style.opacity = '0';
        targetPage.style.transform = 'translateY(20px)';
        
        // Trigger animation
        requestAnimationFrame(() => {
            targetPage.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            targetPage.style.opacity = '1';
            targetPage.style.transform = 'translateY(0)';
        });
        
        // Focus first input after animation completes
        setTimeout(() => {
            const firstInput = targetPage.querySelector('input[type="email"], input[type="password"]');
            if (firstInput && !firstInput.disabled) {
                firstInput.focus();
            }
            isNavigating = false;
        }, 400);
    } else {
        isNavigating = false;
    }
}

// Authentication handlers
async function handleLogin(event) {
    console.log('handleLogin function called');
    event.preventDefault();
    showLoader(elements.loginForm, true);

    // Clear previous errors
    elements.emailError.textContent = '';
    elements.passwordError.textContent = '';
    showToast('', 'hide');

    const email = elements.loginEmail.value.trim();
    const password = elements.loginPassword.value;

    // Basic client-side validation (optional, can be expanded)
    if (email === '') {
        elements.emailError.textContent = appData.formMessages.validation.emailRequired;
        showLoader(elements.loginForm, false);
        return;
    }
    if (password === '') {
        elements.passwordError.textContent = appData.formMessages.validation.passwordRequired;
        showLoader(elements.loginForm, false);
        return;
    }

    try {
        console.log('Fetching with URL:', '/login', 'and options:', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'email': email,
                'password': password
            })
        });
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                'email': email,
                'password': password
            })
        });

        if (response.ok) {
            if (response.redirected) {
                // If FastAPI redirected, follow the redirect manually on the client-side
                window.location.href = response.url;
            } else {
                // This case should ideally not be reached if FastAPI is always redirecting on success
                // You might want to show a success message or redirect to a default page
                console.log('Login successful, but no redirect was followed by the client.');
                showToast('Login successful! Redirecting...', 'success');
                // Optionally, redirect to a default page if no redirect occurred
                // window.location.href = '/generator/index.html';
            }
        } else {
            // If login fails, FastAPI will return a template response with an error
            // We need to parse the HTML and extract the error message
            const errorHtml = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(errorHtml, 'text/html');
            const errorMessageElement = doc.querySelector('.auth-form .error-message'); // Adjust selector as per your HTML
            let errorMessage = appData.formMessages.validation.loginFailed;
            if (errorMessageElement && errorMessageElement.textContent) {
                errorMessage = errorMessageElement.textContent.trim();
            }
            showToast(errorMessage, 'error');
            showLoader(elements.loginForm, false);
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast(appData.formMessages.validation.networkError, 'error');
        showLoader(elements.loginForm, false);
    }
}

async function handleForgotPassword(e) {
    e.preventDefault();
    
    const email = elements.forgotEmail.value.trim();
    
    // Clear previous errors
    clearError(elements.forgotEmailError);
    elements.forgotSuccessMessage.classList.add('hidden');
    
    // Validate email
    if (!email) {
        showError(elements.forgotEmailError, appData.formMessages.validation.emailRequired);
        return;
    }
    
    if (!validateEmailFormat(email)) {
        showError(elements.forgotEmailError, appData.formMessages.validation.emailInvalid);
        return;
    }
    
    // Show loading state
    showButtonLoading(elements.forgotPasswordForm.querySelector('.btn-primary'));
    
    try {
        // Simulate sending reset email
        await simulateResetEmail(email);
        
        // Show success message
        elements.forgotSuccessMessage.classList.remove('hidden');
        showToast('Password reset link sent successfully!', 'success');
        
        // Auto redirect to login after 3 seconds
        setTimeout(() => {
            showPage('loginPage');
            showToast('You can now check your email for the reset link.', 'success');
        }, 3000);
        
    } catch (error) {
        showError(elements.forgotEmailError, error.message);
        showToast('Failed to send reset email. Please try again.', 'error');
    } finally {
        hideButtonLoading(elements.forgotPasswordForm.querySelector('.btn-primary'), 'Send Reset Link');
    }
}

async function handleResetPassword(e) {
    e.preventDefault();
    
    const newPassword = elements.newPassword.value;
    const confirmPassword = elements.confirmPassword.value;
    
    // Clear previous errors
    clearError(elements.newPasswordError);
    clearError(elements.confirmPasswordError);
    elements.resetSuccessMessage.classList.add('hidden');
    
    // Validate passwords
    let isValid = true;
    
    if (!newPassword) {
        showError(elements.newPasswordError, appData.formMessages.validation.passwordRequired);
        isValid = false;
    } else if (!validatePasswordStrength(newPassword)) {
        showError(elements.newPasswordError, 'Password does not meet requirements');
        isValid = false;
    }
    
    if (!confirmPassword) {
        showError(elements.confirmPasswordError, 'Please confirm your password');
        isValid = false;
    } else if (newPassword !== confirmPassword) {
        showError(elements.confirmPasswordError, appData.formMessages.validation.passwordsNoMatch);
        isValid = false;
    }
    
    if (!isValid) return;
    
    // Show loading state
    showButtonLoading(elements.resetPasswordForm.querySelector('.btn-primary'));
    
    try {
        // Simulate password reset
        await simulatePasswordReset(newPassword);
        
        // Show success message
        elements.resetSuccessMessage.classList.remove('hidden');
        showToast('Password reset successfully!', 'success');
        
        // Auto redirect to login after 2 seconds
        setTimeout(() => {
            showPage('loginPage');
            showToast('You can now sign in with your new password.', 'success');
            
            // Clear form
            elements.resetPasswordForm.reset();
            resetPasswordStrength();
        }, 2000);
        
    } catch (error) {
        showError(elements.newPasswordError, error.message);
        showToast('Failed to reset password. Please try again.', 'error');
    } finally {
        hideButtonLoading(elements.resetPasswordForm.querySelector('.btn-primary'), 'Reset Password');
    }
}

// Password utilities
function togglePassword(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    
    if (!input || !toggle) return;
    
    const icon = toggle.querySelector('i');
    if (!icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'ri-eye-line';
    } else {
        input.type = 'password';
        icon.className = 'ri-eye-off-line';
    }
}

function checkPasswordStrength() {
    const password = elements.newPassword.value;
    const requirements = appData.authenticationRequirements.passwordRequirements;
    
    // Reset all requirements
    const reqs = [elements.reqLength, elements.reqUpper, elements.reqNumber, elements.reqSpecial];
    reqs.forEach(req => {
        if (req) req.classList.remove('met');
    });
    
    let score = 0;
    let strengthText = 'Enter password';
    let strengthClass = '';
    
    if (password.length === 0) {
        resetPasswordStrength();
        return;
    }
    
    // Check length requirement
    if (password.length >= requirements.minLength) {
        if (elements.reqLength) elements.reqLength.classList.add('met');
        score += 25;
    }
    
    // Check uppercase and lowercase requirement
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
        if (elements.reqUpper) elements.reqUpper.classList.add('met');
        score += 25;
    }
    
    // Check number requirement
    if (/\d/.test(password)) {
        if (elements.reqNumber) elements.reqNumber.classList.add('met');
        score += 25;
    }
    
    // Check special character requirement
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        if (elements.reqSpecial) elements.reqSpecial.classList.add('met');
        score += 25;
    }
    
    // Update strength indicator
    if (score < 50) {
        strengthText = 'Weak';
        strengthClass = 'weak';
    } else if (score < 75) {
        strengthText = 'Fair';
        strengthClass = 'fair';
    } else if (score < 100) {
        strengthText = 'Good';
        strengthClass = 'good';
    } else {
        strengthText = 'Strong';
        strengthClass = 'strong';
    }
    
    if (elements.strengthProgress) {
        elements.strengthProgress.className = `strength-progress ${strengthClass}`;
    }
    if (elements.strengthText) {
        elements.strengthText.textContent = strengthText;
    }
    passwordStrengthScore = score;
}

function checkPasswordMatch() {
    const newPassword = elements.newPassword.value;
    const confirmPassword = elements.confirmPassword.value;
    
    clearError(elements.confirmPasswordError);
    
    if (confirmPassword && newPassword !== confirmPassword) {
        showError(elements.confirmPasswordError, appData.formMessages.validation.passwordsNoMatch);
    }
}

function resetPasswordStrength() {
    if (elements.strengthProgress) {
        elements.strengthProgress.className = 'strength-progress';
    }
    if (elements.strengthText) {
        elements.strengthText.textContent = 'Enter password';
    }
    passwordStrengthScore = 0;
    
    const reqs = [elements.reqLength, elements.reqUpper, elements.reqNumber, elements.reqSpecial];
    reqs.forEach(req => {
        if (req) req.classList.remove('met');
    });
}

// Validation functions
function validateEmail(input, errorElement) {
    if (!input || !errorElement) return false;
    
    const email = input.value.trim();
    
    if (!email) {
        showError(errorElement, appData.formMessages.validation.emailRequired);
        return false;
    }
    
    if (!validateEmailFormat(email)) {
        showError(errorElement, appData.formMessages.validation.emailInvalid);
        return false;
    }
    
    clearError(errorElement);
    return true;
}

function validatePassword(input, errorElement) {
    if (!input || !errorElement) return false;
    
    const password = input.value;
    
    if (!password) {
        showError(errorElement, appData.formMessages.validation.passwordRequired);
        return false;
    }
    
    if (password.length < appData.authenticationRequirements.passwordRequirements.minLength) {
        showError(errorElement, appData.formMessages.validation.passwordTooShort);
        return false;
    }
    
    clearError(errorElement);
    return true;
}

function validateEmailFormat(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePasswordStrength(password) {
    const requirements = appData.authenticationRequirements.passwordRequirements;
    
    return password.length >= requirements.minLength &&
           /[a-z]/.test(password) &&
           /[A-Z]/.test(password) &&
           /\d/.test(password) &&
           /[!@#$%^&*(),.?":{}|<>]/.test(password);
}

// Authentication simulation
async function simulateAuth(email, password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            // Check if user exists in sample users
            const user = appData.sampleUsers.find(u => u.email === email);
            
            if (user && password === 'password123') { // Simple demo password
                resolve({ user, success: true });
            } else if (email === 'demo@kclas.ac.in' && password === 'demo123') {
                resolve({ 
                    user: { 
                        email, 
                        name: 'Demo User', 
                        role: 'Faculty' 
                    }, 
                    success: true 
                });
            } else {
                reject(new Error(appData.formMessages.validation.loginFailed));
            }
        }, 1500);
    });
}

async function simulateResetEmail(email) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (validateEmailFormat(email)) {
                resolve({ success: true });
            } else {
                reject(new Error('Invalid email address'));
            }
        }, 2000);
    });
}

async function simulatePasswordReset(password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (validatePasswordStrength(password)) {
                resolve({ success: true });
            } else {
                reject(new Error('Password does not meet requirements'));
            }
        }, 1500);
    });
}

// UI utilities
function showError(errorElement, message) {
    if (!errorElement || !message) return;
    
    errorElement.textContent = message;
    errorElement.style.opacity = '0';
    errorElement.style.transform = 'translateY(-10px)';
    
    requestAnimationFrame(() => {
        errorElement.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        errorElement.style.opacity = '1';
        errorElement.style.transform = 'translateY(0)';
    });
}

function clearError(errorElement) {
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.opacity = '0';
    }
}

function showButtonLoading(button) {
    if (!button) return;
    
    const textSpan = button.querySelector('span:not(.btn-loader span)');
    const loader = button.querySelector('.btn-loader');
    
    if (textSpan) textSpan.style.display = 'none';
    if (loader) loader.classList.remove('hidden');
    
    button.disabled = true;
    button.style.cursor = 'not-allowed';
}

function hideButtonLoading(button, originalText) {
    if (!button) return;
    
    const textSpan = button.querySelector('span:not(.btn-loader span)');
    const loader = button.querySelector('.btn-loader');
    
    if (textSpan) {
        textSpan.style.display = 'inline';
        if (originalText) textSpan.textContent = originalText;
    }
    if (loader) loader.classList.add('hidden');
    
    button.disabled = false;
    button.style.cursor = 'pointer';
}

function showToast(message, type = 'success') {
    if (!elements.toastContainer || !message) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconClass = type === 'success' ? 'ri-check-line' : 'ri-error-warning-line';
    
    toast.innerHTML = `
        <i class="toast-icon ${iconClass}"></i>
        <span class="toast-message">${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Trigger show animation
    setTimeout(() => toast.classList.add('show'), 100);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

// Enhanced keyboard navigation
document.addEventListener('keydown', function(e) {
    // Prevent navigation during transitions
    if (isNavigating) {
        e.preventDefault();
        return;
    }
    
    // Enter key on forms
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const form = e.target.closest('form');
        if (form) {
            const submitButton = form.querySelector('button[type="submit"]');
            if (submitButton && !submitButton.disabled) {
                e.preventDefault();
                submitButton.click();
            }
        }
    }
    
    // Escape key to go back to login
    if (e.key === 'Escape' && currentPage !== 'loginPage') {
        showPage('loginPage');
    }
});

// Add focus management for better accessibility
document.addEventListener('focusin', function(e) {
    if (e.target.matches('input, button')) {
        e.target.parentNode.style.position = 'relative';
        e.target.style.zIndex = '10';
    }
});

document.addEventListener('focusout', function(e) {
    if (e.target.matches('input, button')) {
        e.target.style.zIndex = 'auto';
    }
});

// Auto-redirect demo for testing
setTimeout(() => {
    if (currentPage === 'loginPage') {
        showToast('Demo credentials: demo@kclas.ac.in / demo123', 'success');
    }
}, 2000);