// Improved verification token function with better error handling
const verifyToken = async (token) => {
    try {
        const response = await fetch(`${API_URL}/verify?token=${token}`);
        
        // Handle non-JSON responses (e.g., 500 errors that might return HTML)
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            // If not JSON, create a generic error object
            data = { detail: 'Server error. Please try again later.' };
        }
        
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

// Improved resend verification with better error handling
submitResendBtn.addEventListener('click', async () => {
    const email = resendEmail.value.trim();
    
    if (!email) {
        resendMessage.textContent = 'Please enter your email address';
        resendMessage.className = 'auth-message error';
        return;
    }
    
    resendMessage.textContent = 'Sending verification email...';
    resendMessage.className = 'auth-message info';
    submitResendBtn.disabled = true; // Prevent multiple submissions
    
    try {
        // Add a preflight OPTIONS request check to ensure CORS is working
        const response = await fetch(`${API_URL}/resend-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ email: email })
        });
        
        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { detail: 'Server returned an invalid response' };
        }
        
        if (response.ok) {
            resendMessage.textContent = 'Verification email sent! Please check your inbox.';
            resendMessage.className = 'auth-message success';
            
            // Store email in local storage for future use
            localStorage.setItem('pendingEmail', email);
        } else {
            resendMessage.textContent = data.detail || 'Failed to send verification email.';
            resendMessage.className = 'auth-message error';
            
            // Log more details for debugging
            console.error('Resend verification failed:', {
                status: response.status,
                statusText: response.statusText,
                data: data
            });
        }
    } catch (error) {
        console.error('Resend verification error:', error);
        resendMessage.textContent = 'An error occurred. Please try again.';
        resendMessage.className = 'auth-message error';
    } finally {
        submitResendBtn.disabled = false; // Re-enable the button
    }
});
