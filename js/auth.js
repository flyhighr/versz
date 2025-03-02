document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://versz-vs1b.onrender.com';
    
    // Toggle password visibility
    const passwordToggles = document.querySelectorAll('.password-toggle');
    passwordToggles.forEach(toggle => {
        toggle.addEventListener('click', function() {
            const passwordField = this.parentElement.querySelector('input');
            const type = passwordField.getAttribute('type');
            
            if (type === 'password') {
                passwordField.setAttribute('type', 'text');
                this.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                passwordField.setAttribute('type', 'password');
                this.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });
    
    // Login form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const loginMessage = document.getElementById('login-message');
            
            loginMessage.textContent = 'Logging in...';
            loginMessage.className = 'auth-message info';
            
            try {
                const formData = new FormData();
                formData.append('username', email); // API expects 'username' field for email
                formData.append('password', password);
                
                const response = await fetch(`${API_URL}/token`, {
                    method: 'POST',
                    body: formData
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    loginMessage.textContent = 'Login successful! Redirecting...';
                    loginMessage.className = 'auth-message success';
                    
                    // Save auth data to localStorage
                    localStorage.setItem('token', data.access_token);
                    localStorage.setItem('user', JSON.stringify({
                        id: data.id,
                        email: data.email,
                        username: data.username,
                        name: data.name,
                        avatar_url: data.avatar_url,
                        is_verified: data.is_verified
                    }));
                    
                    // Redirect based on verification status
                    if (data.is_verified) {
                        if (!data.username) {
                            // User needs to complete onboarding
                            window.location.href = 'onboarding.html';
                        } else {
                            // User is fully set up
                            window.location.href = 'dashboard.html';
                        }
                    } else {
                        // User needs to verify email
                        window.location.href = 'verify-prompt.html';
                    }
                } else {
                    loginMessage.textContent = data.detail || 'Login failed. Please check your credentials.';
                    loginMessage.className = 'auth-message error';
                }
            } catch (error) {
                console.error('Login error:', error);
                loginMessage.textContent = 'An error occurred. Please try again.';
                loginMessage.className = 'auth-message error';
            }
        });
    }
    
    // Register form handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        const passwordField = document.getElementById('register-password');
        const reqLength = document.getElementById('req-length');
        const reqUppercase = document.getElementById('req-uppercase');
        const reqLowercase = document.getElementById('req-lowercase');
        const reqNumber = document.getElementById('req-number');
        
        // Password validation
        if (passwordField) {
            passwordField.addEventListener('input', function() {
                const password = this.value;
                
                // Check requirements
                const hasLength = password.length >= 8;
                const hasUppercase = /[A-Z]/.test(password);
                const hasLowercase = /[a-z]/.test(password);
                const hasNumber = /[0-9]/.test(password);
                
                // Update UI
                reqLength.innerHTML = `<i class="fas ${hasLength ? 'fa-check' : 'fa-times'}"></i> At least 8 characters`;
                reqLength.className = hasLength ? 'valid' : '';
                
                reqUppercase.innerHTML = `<i class="fas ${hasUppercase ? 'fa-check' : 'fa-times'}"></i> One uppercase letter`;
                reqUppercase.className = hasUppercase ? 'valid' : '';
                
                reqLowercase.innerHTML = `<i class="fas ${hasLowercase ? 'fa-check' : 'fa-times'}"></i> One lowercase letter`;
                reqLowercase.className = hasLowercase ? 'valid' : '';
                
                reqNumber.innerHTML = `<i class="fas ${hasNumber ? 'fa-check' : 'fa-times'}"></i> One number`;
                reqNumber.className = hasNumber ? 'valid' : '';
            });
        }
        
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('register-email').value;
            const password = document.getElementById('register-password').value;
            const registerMessage = document.getElementById('register-message');
            
            // Validate password
            const hasLength = password.length >= 8;
            const hasUppercase = /[A-Z]/.test(password);
            const hasLowercase = /[a-z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            
            if (!hasLength || !hasUppercase || !hasLowercase || !hasNumber) {
                registerMessage.textContent = 'Please meet all password requirements.';
                registerMessage.className = 'auth-message error';
                return;
            }
            
            registerMessage.textContent = 'Creating your account...';
            registerMessage.className = 'auth-message info';
            
            try {
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    registerMessage.textContent = 'Account created! Please check your email to verify your account.';
                    registerMessage.className = 'auth-message success';
                    
                    // Redirect to verification prompt page
                    setTimeout(() => {
                        localStorage.setItem('pendingEmail', email);
                        window.location.href = 'verify-prompt.html';
                    }, 2000);
                } else {
                    registerMessage.textContent = data.detail || 'Registration failed. Please try again.';
                    registerMessage.className = 'auth-message error';
                }
            } catch (error) {
                console.error('Registration error:', error);
                registerMessage.textContent = 'An error occurred. Please try again.';
                registerMessage.className = 'auth-message error';
            }
        });
    }
    
    // Reset password form handler
    const resetForm = document.getElementById('reset-form');
    if (resetForm) {
        resetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('reset-email').value;
            const resetMessage = document.getElementById('reset-message');
            
            resetMessage.textContent = 'Sending reset link...';
            resetMessage.className = 'auth-message info';
            
            try {
                const response = await fetch(`${API_URL}/request-password-reset`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resetMessage.textContent = 'Reset code sent! Please check your email.';
                    resetMessage.className = 'auth-message success';
                    
                    // Save email for reset code page and redirect
                    localStorage.setItem('resetEmail', email);
                    setTimeout(() => {
                        window.location.href = 'reset-code.html';
                    }, 2000);
                } else {
                    resetMessage.textContent = data.detail || 'Failed to send reset link. Please try again.';
                    resetMessage.className = 'auth-message error';
                }
            } catch (error) {
                console.error('Reset request error:', error);
                resetMessage.textContent = 'An error occurred. Please try again.';
                resetMessage.className = 'auth-message error';
            }
        });
    }
    
    // Reset code form handler
    const resetCodeForm = document.getElementById('reset-code-form');
    if (resetCodeForm) {
        // Prefill email from localStorage
        const resetEmail = localStorage.getItem('resetEmail');
        if (resetEmail) {
            document.getElementById('reset-email-hidden').value = resetEmail;
        } else {
            // Redirect if no email is stored
            window.location.href = 'reset-password.html';
        }
        
        // New password validation
        const newPasswordField = document.getElementById('new-password');
        const newReqLength = document.getElementById('new-req-length');
        const newReqUppercase = document.getElementById('new-req-uppercase');
        const newReqLowercase = document.getElementById('new-req-lowercase');
        const newReqNumber = document.getElementById('new-req-number');
        
        if (newPasswordField) {
            newPasswordField.addEventListener('input', function() {
                const password = this.value;
                
                // Check requirements
                const hasLength = password.length >= 8;
                const hasUppercase = /[A-Z]/.test(password);
                const hasLowercase = /[a-z]/.test(password);
                const hasNumber = /[0-9]/.test(password);
                
                // Update UI
                newReqLength.innerHTML = `<i class="fas ${hasLength ? 'fa-check' : 'fa-times'}"></i> At least 8 characters`;
                newReqLength.className = hasLength ? 'valid' : '';
                
                newReqUppercase.innerHTML = `<i class="fas ${hasUppercase ? 'fa-check' : 'fa-times'}"></i> One uppercase letter`;
                newReqUppercase.className = hasUppercase ? 'valid' : '';
                
                newReqLowercase.innerHTML = `<i class="fas ${hasLowercase ? 'fa-check' : 'fa-times'}"></i> One lowercase letter`;
                newReqLowercase.className = hasLowercase ? 'valid' : '';
                
                newReqNumber.innerHTML = `<i class="fas ${hasNumber ? 'fa-check' : 'fa-times'}"></i> One number`;
                newReqNumber.className = hasNumber ? 'valid' : '';
            });
        }
        
        resetCodeForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('reset-email-hidden').value;
            const resetCode = document.getElementById('reset-code').value;
            const newPassword = document.getElementById('new-password').value;
            const resetCodeMessage = document.getElementById('reset-code-message');
            
            // Validate password
            const hasLength = newPassword.length >= 8;
            const hasUppercase = /[A-Z]/.test(newPassword);
            const hasLowercase = /[a-z]/.test(newPassword);
            const hasNumber = /[0-9]/.test(newPassword);
            
            if (!hasLength || !hasUppercase || !hasLowercase || !hasNumber) {
                resetCodeMessage.textContent = 'Please meet all password requirements.';
                resetCodeMessage.className = 'auth-message error';
                return;
            }
            
            resetCodeMessage.textContent = 'Resetting password...';
            resetCodeMessage.className = 'auth-message info';
            
            try {
                const response = await fetch(`${API_URL}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: email,
                        reset_code: resetCode,
                        new_password: newPassword
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resetCodeMessage.textContent = 'Password reset successful! Redirecting to login...';
                    resetCodeMessage.className = 'auth-message success';
                    
                    // Clear stored email and redirect to login
                    localStorage.removeItem('resetEmail');
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    resetCodeMessage.textContent = data.detail || 'Failed to reset password. Please try again.';
                    resetCodeMessage.className = 'auth-message error';
                }
            } catch (error) {
                console.error('Password reset error:', error);
                resetCodeMessage.textContent = 'An error occurred. Please try again.';
                resetCodeMessage.className = 'auth-message error';
            }
        });
    }
});