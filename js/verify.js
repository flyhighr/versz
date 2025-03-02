document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://versz-vs1b.onrender.com';
    
    const verifyLoading = document.getElementById('verify-loading');
    const verifySuccess = document.getElementById('verify-success');
    const verifyError = document.getElementById('verify-error');
    const verifyMessage = document.getElementById('verify-message');
    const errorMessage = document.getElementById('error-message');
    const resendBtn = document.getElementById('resend-btn');
    const resendForm = document.getElementById('resend-form');
    const submitResendBtn = document.getElementById('submit-resend');
    const resendEmail = document.getElementById('resend-email');
    const resendMessage = document.getElementById('resend-message');
    
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    const verifyToken = async (token) => {
        try {
            const response = await fetch(`${API_URL}/verify?token=${token}`);
            const data = await response.json();
            
            if (response.ok) {
                // Show success message
                verifyLoading.style.display = 'none';
                verifySuccess.style.display = 'block';
                verifyMessage.textContent = 'Your email has been verified successfully!';
                
                // If user was already logged in, update local storage
                const userData = localStorage.getItem('user');
                if (userData) {
                    const user = JSON.parse(userData);
                    user.is_verified = true;
                    localStorage.setItem('user', JSON.stringify(user));
                }
            } else {
                // Show error message
                verifyLoading.style.display = 'none';
                verifyError.style.display = 'block';
                errorMessage.textContent = data.detail || 'Verification link is invalid or has expired.';
            }
        } catch (error) {
            console.error('Verification error:', error);
            verifyLoading.style.display = 'none';
            verifyError.style.display = 'block';
            errorMessage.textContent = 'An error occurred during verification. Please try again.';
        }
    };
    
    // If token is provided in URL, verify it
    if (token) {
        verifyToken(token);
    } else {
        // No token provided, show error
        verifyLoading.style.display = 'none';
        verifyError.style.display = 'block';
        errorMessage.textContent = 'No verification token provided. Please check your email link.';
    }
    
    // Resend verification button
    if (resendBtn) {
        resendBtn.addEventListener('click', () => {
            verifyError.style.display = 'none';
            resendForm.style.display = 'block';
            
            // Try to prefill email if available
            const pendingEmail = localStorage.getItem('pendingEmail');
            if (pendingEmail) {
                resendEmail.value = pendingEmail;
            }
        });
    }
    
    // Submit resend form
    if (submitResendBtn) {
        submitResendBtn.addEventListener('click', async () => {
            const email = resendEmail.value.trim();
            
            if (!email) {
                resendMessage.textContent = 'Please enter your email address';
                resendMessage.className = 'auth-message error';
                return;
            }
            
            resendMessage.textContent = 'Sending verification email...';
            resendMessage.className = 'auth-message info';
            
            try {
                const response = await fetch(`${API_URL}/resend-verification`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: `email=${encodeURIComponent(email)}`
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    resendMessage.textContent = 'Verification email sent! Please check your inbox.';
                    resendMessage.className = 'auth-message success';
                    
                    // Store email in local storage for future use
                    localStorage.setItem('pendingEmail', email);
                } else {
                    resendMessage.textContent = data.detail || 'Failed to send verification email.';
                    resendMessage.className = 'auth-message error';
                }
            } catch (error) {
                console.error('Resend verification error:', error);
                resendMessage.textContent = 'An error occurred. Please try again.';
                resendMessage.className = 'auth-message error';
            }
        });
    }
});