document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://api.versz.fun';
    
    const userEmail = document.getElementById('user-email');
    const resendBtn = document.getElementById('resend-btn');
    const resendForm = document.getElementById('resend-form');
    const submitResendBtn = document.getElementById('submit-resend');
    const resendEmail = document.getElementById('resend-email');
    const resendMessage = document.getElementById('resend-message');
    
    // Check if we have a pending email in localStorage
    const pendingEmail = localStorage.getItem('pendingEmail');
    if (pendingEmail) {
        userEmail.textContent = pendingEmail;
        resendEmail.value = pendingEmail;
    }
    
    // Resend verification button
    if (resendBtn) {
        resendBtn.addEventListener('click', () => {
            document.querySelector('.verification-status').style.display = 'none';
            resendForm.style.display = 'block';
            
            // Try to prefill email if available
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
                resendMessage.style.display = 'block';
                return;
            }
            
            resendMessage.textContent = 'Sending verification email...';
            resendMessage.className = 'auth-message info';
            resendMessage.style.display = 'block';
            submitResendBtn.disabled = true;
            
            try {
                const response = await fetch(`${API_URL}/resend-verification`, {
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
                    resendMessage.textContent = 'Verification email sent! Please check your inbox.';
                    resendMessage.className = 'auth-message success';
                    
                    // Store email in local storage for future use
                    localStorage.setItem('pendingEmail', email);
                    userEmail.textContent = email;
                    
                    // Show the status again after 3 seconds
                    setTimeout(() => {
                        resendForm.style.display = 'none';
                        document.querySelector('.verification-status').style.display = 'block';
                    }, 3000);
                } else {
                    resendMessage.textContent = data.detail || 'Failed to send verification email.';
                    resendMessage.className = 'auth-message error';
                }
            } catch (error) {
                console.error('Resend verification error:', error);
                resendMessage.textContent = 'An error occurred. Please try again.';
                resendMessage.className = 'auth-message error';
            } finally {
                submitResendBtn.disabled = false;
            }
        });
    }
});
