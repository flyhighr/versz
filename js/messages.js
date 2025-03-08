document.addEventListener('DOMContentLoaded', function() {
    const API_URL = 'https://api.versz.fun';
    let allPages = [];
    let currentTab = 'messages';
    let pendingMessagesCount = 0;
    let pendingDrawingsCount = 0;
    let currentMessageFilter = 'all';
    let currentMessagePageFilter = 'all';
    let currentDrawingPageFilter = 'all';
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.add('show');
            overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }
    
    // Sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebar-toggle');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function() {
            sidebar.classList.remove('show');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Close sidebar when clicking overlay
    if (overlay) {
        overlay.addEventListener('click', function() {
            sidebar.classList.remove('show');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    }
    
    // Logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Show confirmation notification
            showNotification({
                title: 'Logging out',
                message: 'You are being logged out...',
                type: 'info',
                duration: 2000
            });
            
            setTimeout(() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }, 1000);
        });
    }
    
    // Load user data for sidebar
    const loadUserData = async () => {
        try {
            const response = await fetch(`${API_URL}/me`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid
                    showNotification({
                        title: 'Session Expired',
                        message: 'Your session has expired. Please log in again.',
                        type: 'error'
                    });
                    
                    setTimeout(() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.location.href = 'login.html';
                    }, 2000);
                    return;
                }
                throw new Error('Failed to fetch user data');
            }
            
            const userData = await response.json();
            
            // Update sidebar user info
            const usernameElement = document.getElementById('sidebar-username');
            const emailElement = document.getElementById('sidebar-email');
            const avatarElement = document.getElementById('sidebar-avatar');
            
            // Clear loading states
            usernameElement.innerHTML = userData.username || 'User';
            emailElement.innerHTML = userData.email;
            
            if (userData.avatar_url) {
                avatarElement.onload = function() {
                    this.classList.add('loaded');
                    avatarElement.parentElement.querySelector('.avatar-loading').style.display = 'none';
                };
                avatarElement.src = userData.avatar_url;
            } else {
                avatarElement.classList.add('loaded');
                avatarElement.parentElement.querySelector('.avatar-loading').style.display = 'none';
            }
            
            return userData;
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification({
                title: 'Error',
                message: 'Failed to load user data. Please refresh the page.',
                type: 'error'
            });
        }
    };
    
    // Load all user pages
    const loadAllPages = async () => {
        try {
            const response = await fetch(`${API_URL}/pages`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch pages');
            }
            
            const pages = await response.json();
            allPages = pages; // Store globally
            return pages;
        } catch (error) {
            console.error('Error loading pages:', error);
            showNotification({
                title: 'Error Loading Pages',
                message: 'Failed to load your pages. Please try again.',
                type: 'error'
            });
            return [];
        }
    };
    
    // Populate page select dropdowns
    const populatePageSelects = (pages) => {
        const messagePageSelect = document.getElementById('page-select-messages');
        const drawingPageSelect = document.getElementById('page-select-drawings');
        
        // Clear any existing options except the default
        while (messagePageSelect.options.length > 1) {
            messagePageSelect.remove(1);
        }
        
        while (drawingPageSelect.options.length > 1) {
            drawingPageSelect.remove(1);
        }
        
        // Add pages to dropdowns
        pages.forEach(page => {
            // For messages dropdown
            const messageOption = document.createElement('option');
            messageOption.value = page.page_id;
            messageOption.textContent = page.title || 'Untitled Page';
            messagePageSelect.appendChild(messageOption);
            
            // For drawings dropdown
            const drawingOption = document.createElement('option');
            drawingOption.value = page.page_id;
            drawingOption.textContent = page.title || 'Untitled Page';
            drawingPageSelect.appendChild(drawingOption);
        });
        
        // Add event listeners for page selection
        messagePageSelect.addEventListener('change', () => {
            currentMessagePageFilter = messagePageSelect.value;
            loadMessages();
        });
        
        drawingPageSelect.addEventListener('change', () => {
            currentDrawingPageFilter = drawingPageSelect.value;
            loadDrawings();
        });
    };
    
    // Setup tab switching
    const setupTabs = () => {
        const tabButtons = document.querySelectorAll('.tab-btn');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all tabs
                tabButtons.forEach(btn => btn.classList.remove('active'));
                
                // Add active class to clicked tab
                button.classList.add('active');
                
                // Hide all tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Show selected tab content
                const tabId = button.dataset.tab;
                document.getElementById(`${tabId}-tab`).classList.add('active');
                
                // Update current tab
                currentTab = tabId;
                
                // Load content for the tab if needed
                if (tabId === 'messages') {
                    loadMessages();
                } else if (tabId === 'drawings') {
                    loadDrawings();
                }
            });
        });
    };
    
    // Setup message filter
    const setupMessageFilter = () => {
        const filterSelect = document.getElementById('message-filter');
        
        filterSelect.addEventListener('change', () => {
            currentMessageFilter = filterSelect.value;
            loadMessages();
            loadDrawings();
        });
    };
    
    // Load messages
    const loadMessages = async () => {
        // Show loading state
        document.getElementById('messages-loading').style.display = 'flex';
        document.getElementById('no-messages').style.display = 'none';
        document.getElementById('messages-error').style.display = 'none';
        
        // Clear existing messages
        const messagesContainer = document.getElementById('messages-container');
        messagesContainer.innerHTML = '';
        
        try {
            // Determine if we should show pending only
            const pendingOnly = currentMessageFilter === 'pending';
            const approvedOnly = currentMessageFilter === 'approved';
            
            let url = `${API_URL}/user/messages?pending_only=${pendingOnly}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }
            
            const data = await response.json();
            let messages = data.messages || [];
            
            // Filter messages if needed
            if (currentMessagePageFilter !== 'all') {
                messages = messages.filter(msg => msg.page_id === currentMessagePageFilter);
            }
            
            // Filter by approval status if needed
            if (approvedOnly) {
                messages = messages.filter(msg => msg.approved);
            }
            
            // Hide loading state
            document.getElementById('messages-loading').style.display = 'none';
            
            // Update pending count banner
            pendingMessagesCount = messages.filter(msg => !msg.approved).length;
            document.getElementById('pending-messages-count').textContent = pendingMessagesCount;
            document.getElementById('pending-messages-banner').style.display = 
                pendingMessagesCount > 0 ? 'flex' : 'none';
            
            // Show empty state if no messages
            if (messages.length === 0) {
                document.getElementById('no-messages').style.display = 'flex';
                return;
            }
            
            // Render messages
            messages.forEach(message => {
                const messageCard = createMessageCard(message);
                messagesContainer.appendChild(messageCard);
            });
            
        } catch (error) {
            console.error('Error loading messages:', error);
            
            // Show error state
            document.getElementById('messages-loading').style.display = 'none';
            document.getElementById('messages-error').style.display = 'flex';
            
            const retryBtn = document.getElementById('retry-messages-btn');
            if (retryBtn) {
                // Remove existing event listeners
                const newRetryBtn = retryBtn.cloneNode(true);
                retryBtn.parentNode.replaceChild(newRetryBtn, retryBtn);
                
                // Add new event listener
                newRetryBtn.addEventListener('click', loadMessages);
            }
        }
    };
    
    const createMessageCard = (message) => {
        const card = document.createElement('div');
        card.className = `message-card ${message.approved ? '' : 'pending'}`;
        card.dataset.id = message.id;
        
        // Format date
        const messageDate = new Date(message.timestamp);
        const formattedDate = messageDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Find page title
        const page = allPages.find(p => p.page_id === message.page_id);
        const pageTitle = page ? page.title : 'Unknown Page';
        
        // Truncate message content if too long
        const maxContentLength = 150;
        let displayContent = message.content;
        if (displayContent.length > maxContentLength) {
            displayContent = displayContent.substring(0, maxContentLength) + '...';
        }
        
        card.innerHTML = `
            <div class="message-header">
                <div class="message-sender">
                    ${message.sender_name ? message.sender_name : '<i class="fas fa-user-secret anonymous-icon"></i> Anonymous'}
                </div>
                <div class="message-date">${formattedDate}</div>
            </div>
            <div class="message-body">
                <div class="message-content">${displayContent}</div>
                <div class="message-page">
                    <i class="fas fa-file-alt"></i> ${pageTitle}
                </div>
            </div>
            <div class="message-actions">
                ${!message.approved ? `
                    <button class="message-btn approve" data-action="approve" data-id="${message.id}">
                        <i class="fas fa-check"></i> Approve
                    </button>
                ` : ''}
                <button class="message-btn view" data-action="view" data-id="${message.id}">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="message-btn delete" data-action="delete" data-id="${message.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        // Add event listeners for buttons
        const approveBtn = card.querySelector('.message-btn.approve');
        if (approveBtn) {
            approveBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                approveMessage(message.id);
            };
        }
        
        const viewBtn = card.querySelector('.message-btn.view');
        if (viewBtn) {
            viewBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                openMessageModal(message);
            };
        }
        
        const deleteBtn = card.querySelector('.message-btn.delete');
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                openDeleteConfirmModal(message.id, 'message');
            };
        }
        
        // Add click event to open modal
        card.addEventListener('click', () => {
            openMessageModal(message);
        });
        
        return card;
    };
    
    // Open message modal
    const openMessageModal = (message) => {
        const modal = document.getElementById('message-action-modal');
        const senderEl = document.getElementById('modal-sender');
        const dateEl = document.getElementById('modal-date');
        const pageEl = document.getElementById('modal-page');
        const contentEl = document.getElementById('modal-content');
        const approvalActions = document.getElementById('approval-actions');
        const approvedActions = document.getElementById('approved-actions');
        
        // Find page title
        const page = allPages.find(p => p.page_id === message.page_id);
        const pageTitle = page ? page.title : 'Unknown Page';
        
        // Format date
        const messageDate = new Date(message.timestamp);
        const formattedDate = messageDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Set content
        senderEl.textContent = message.sender_name || 'Anonymous';
        dateEl.textContent = formattedDate;
        pageEl.textContent = pageTitle;
        contentEl.textContent = message.content;
        
        // Show appropriate actions
        if (message.approved) {
            approvalActions.style.display = 'none';
            approvedActions.style.display = 'flex';
            
            // Set up delete button
            const deleteBtn = document.getElementById('delete-message-btn');
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            newDeleteBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                openDeleteConfirmModal(message.id, 'message');
            });
            
        } else {
            approvalActions.style.display = 'flex';
            approvedActions.style.display = 'none';
            
            // Set up approve button
            const approveBtn = document.getElementById('approve-message-btn');
            const newApproveBtn = approveBtn.cloneNode(true);
            approveBtn.parentNode.replaceChild(newApproveBtn, approveBtn);
            newApproveBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                approveMessage(message.id);
            });
            
            // Set up reject button
            const rejectBtn = document.getElementById('reject-message-btn');
            const newRejectBtn = rejectBtn.cloneNode(true);
            rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
            newRejectBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                openDeleteConfirmModal(message.id, 'message');
            });
        }
        
        // Show modal
        modal.classList.add('active');
        
        // Close modal when clicking outside or on close button
        const handleModalClick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                modal.removeEventListener('click', handleModalClick);
            }
        };
        
        modal.addEventListener('click', handleModalClick);
        
        const closeBtn = modal.querySelector('.modal-close');
        const handleCloseClick = () => {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', handleCloseClick);
        };
        
        closeBtn.addEventListener('click', handleCloseClick);
    };
    
    // Approve message
    const approveMessage = async (messageId) => {
        try {
            const response = await fetch(`${API_URL}/messages/${messageId}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to approve message');
            }
            
            showNotification({
                title: 'Message Approved',
                message: 'The message has been approved successfully.',
                type: 'success'
            });
            
            // Reload messages
            loadMessages();
            
        } catch (error) {
            console.error('Error approving message:', error);
            showNotification({
                title: 'Error',
                message: 'Failed to approve message. Please try again.',
                type: 'error'
            });
        }
    };
    
    // Delete message
    const deleteMessage = async (messageId) => {
        try {
            const response = await fetch(`${API_URL}/messages/${messageId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to delete message');
            }
            
            showNotification({
                title: 'Message Deleted',
                message: 'The message has been deleted successfully.',
                type: 'success'
            });
            
            // Reload messages
            loadMessages();
            
            return true;
        } catch (error) {
            console.error('Error deleting message:', error);
            showNotification({
                title: 'Error',
                message: error.message || 'Failed to delete message. Please try again.',
                type: 'error'
            });
            throw error; // Re-throw to allow the calling function to handle it
        }
    };
    
    // Load drawings
    const loadDrawings = async () => {
        // Show loading state
        document.getElementById('drawings-loading').style.display = 'flex';
        document.getElementById('no-drawings').style.display = 'none';
        document.getElementById('drawings-error').style.display = 'none';
        
        // Remove any existing drawings grid
        const drawingsContainer = document.getElementById('drawings-container');
        drawingsContainer.innerHTML = '';
        
        // Create new drawings grid
        const drawingsGrid = document.createElement('div');
        drawingsGrid.className = 'drawings-grid';
        drawingsContainer.appendChild(drawingsGrid);
        
        try {
            // Get drawings with or without pending filter
            const pendingOnly = currentMessageFilter === 'pending';
            const approvedOnly = currentMessageFilter === 'approved';
            
            let url = `${API_URL}/user/drawings?pending_only=${pendingOnly}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch drawings');
            }
            
            const data = await response.json();
            let drawings = data.drawings || [];
            
            // Filter drawings if needed
            if (currentDrawingPageFilter !== 'all') {
                drawings = drawings.filter(drawing => drawing.page_id === currentDrawingPageFilter);
            }
            
            // Filter by approval status if needed
            if (approvedOnly) {
                drawings = drawings.filter(drawing => drawing.approved);
            }
            
            // Hide loading state
            document.getElementById('drawings-loading').style.display = 'none';
            
            // Update pending count banner
            pendingDrawingsCount = drawings.filter(drawing => !drawing.approved).length;
            document.getElementById('pending-drawings-count').textContent = pendingDrawingsCount;
            document.getElementById('pending-drawings-banner').style.display = 
                pendingDrawingsCount > 0 ? 'flex' : 'none';
            
            // Show empty state if no drawings
            if (drawings.length === 0) {
                document.getElementById('no-drawings').style.display = 'flex';
                return;
            }
            
            // Render drawings
            drawings.forEach(drawing => {
                const drawingCard = createDrawingCard(drawing);
                drawingsGrid.appendChild(drawingCard);
            });
            
        } catch (error) {
            console.error('Error loading drawings:', error);
            
            // Show error state
            document.getElementById('drawings-loading').style.display = 'none';
            document.getElementById('drawings-error').style.display = 'flex';
            
            const retryBtn = document.getElementById('retry-drawings-btn');
            if (retryBtn) {
                // Remove existing event listeners
                const newRetryBtn = retryBtn.cloneNode(true);
                retryBtn.parentNode.replaceChild(newRetryBtn, retryBtn);
                
                // Add new event listener
                newRetryBtn.addEventListener('click', loadDrawings);
            }
        }
    };
    
    const createDrawingCard = (drawing) => {
        const card = document.createElement('div');
        card.className = `drawing-card ${drawing.approved ? '' : 'pending'}`;
        card.dataset.id = drawing.id;
        
        // Format date
        const drawingDate = new Date(drawing.timestamp);
        const formattedDate = drawingDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        
        // Find page title
        const page = allPages.find(p => p.page_id === drawing.page_id);
        const pageTitle = page ? page.title : 'Unknown Page';
        
        card.innerHTML = `
            <div class="drawing-preview">
                <img src="${drawing.data_url}" alt="Drawing">
            </div>
            <div class="drawing-info">
                <div class="drawing-creator">
                    ${drawing.sender_name ? drawing.sender_name : '<i class="fas fa-user-secret anonymous-icon"></i> Anonymous'}
                </div>
                <div class="drawing-date">${formattedDate}</div>
                <div class="drawing-page">
                    <i class="fas fa-file-alt"></i> ${pageTitle}
                </div>
            </div>
            <div class="drawing-actions">
                ${!drawing.approved ? `
                    <button class="message-btn approve" data-action="approve" data-id="${drawing.id}">
                        <i class="fas fa-check"></i> Approve
                    </button>
                ` : ''}
                <button class="message-btn view" data-action="view" data-id="${drawing.id}">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="message-btn delete" data-action="delete" data-id="${drawing.id}">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        // Add event listeners for buttons
        const approveBtn = card.querySelector('.message-btn.approve');
        if (approveBtn) {
            approveBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                approveDrawing(drawing.id);
            };
        }
        
        const viewBtn = card.querySelector('.message-btn.view');
        if (viewBtn) {
            viewBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                openDrawingModal(drawing);
            };
        }
        
        const deleteBtn = card.querySelector('.message-btn.delete');
        if (deleteBtn) {
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                e.preventDefault();
                openDeleteConfirmModal(drawing.id, 'drawing');
            };
        }
        
        // Add click event to open modal
        card.addEventListener('click', () => {
            openDrawingModal(drawing);
        });
        
        return card;
    };
    
    // Open drawing modal
    const openDrawingModal = (drawing) => {
        const modal = document.getElementById('drawing-preview-modal');
        const creatorEl = document.getElementById('modal-drawing-creator');
        const dateEl = document.getElementById('modal-drawing-date');
        const pageEl = document.getElementById('modal-drawing-page');
        const imageEl = document.getElementById('modal-drawing-image');
        const approvalActions = document.getElementById('drawing-approval-actions');
        const approvedActions = document.getElementById('drawing-approved-actions');
        
        // Find page title
        const page = allPages.find(p => p.page_id === drawing.page_id);
        const pageTitle = page ? page.title : 'Unknown Page';
        
        // Format date
        const drawingDate = new Date(drawing.timestamp);
        const formattedDate = drawingDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Set content
        creatorEl.textContent = drawing.sender_name || 'Anonymous';
        dateEl.textContent = formattedDate;
        pageEl.textContent = pageTitle;
        imageEl.src = drawing.data_url;
        
        // Show appropriate actions
        if (drawing.approved) {
            approvalActions.style.display = 'none';
            approvedActions.style.display = 'flex';
            
            // Set up download button
            const downloadBtn = document.getElementById('download-drawing-btn');
            const newDownloadBtn = downloadBtn.cloneNode(true);
            downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
            newDownloadBtn.addEventListener('click', () => {
                downloadDrawing(drawing);
            });
            
            // Set up delete button
            const deleteBtn = document.getElementById('delete-drawing-btn');
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            newDeleteBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                openDeleteConfirmModal(drawing.id, 'drawing');
            });
            
        } else {
            approvalActions.style.display = 'flex';
            approvedActions.style.display = 'none';
            
            // Set up approve button
            const approveBtn = document.getElementById('approve-drawing-btn');
            const newApproveBtn = approveBtn.cloneNode(true);
            approveBtn.parentNode.replaceChild(newApproveBtn, approveBtn);
            newApproveBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                approveDrawing(drawing.id);
            });
            
            // Set up reject button
            const rejectBtn = document.getElementById('reject-drawing-btn');
            const newRejectBtn = rejectBtn.cloneNode(true);
            rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
            newRejectBtn.addEventListener('click', () => {
                modal.classList.remove('active');
                openDeleteConfirmModal(drawing.id, 'drawing');
            });
        }
        
        // Show modal
        modal.classList.add('active');
        
        // Close modal when clicking outside or on close button
        const handleModalClick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                modal.removeEventListener('click', handleModalClick);
            }
        };
        
        modal.addEventListener('click', handleModalClick);
        
        const closeBtn = modal.querySelector('.modal-close');
        const handleCloseClick = () => {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', handleCloseClick);
        };
        
        closeBtn.addEventListener('click', handleCloseClick);
    };
    
    // Download drawing
    const downloadDrawing = (drawing) => {
        const link = document.createElement('a');
        
        // Generate a filename with timestamp
        const timestamp = new Date(drawing.timestamp).toISOString().replace(/[:.]/g, '-');
        link.download = `drawing-${timestamp}.png`;
        
        // Set the data URL as the link href
        link.href = drawing.data_url;
        
        // Append to document, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification({
            title: 'Download Started',
            message: 'The drawing is being downloaded to your device.',
            type: 'success',
            duration: 3000
        });
    };
    
    // Approve drawing
    const approveDrawing = async (drawingId) => {
        try {
            const response = await fetch(`${API_URL}/drawings/${drawingId}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to approve drawing');
            }
            
            showNotification({
                title: 'Drawing Approved',
                message: 'The drawing has been approved successfully.',
                type: 'success'
            });
            
            // Reload drawings
            loadDrawings();
            
        } catch (error) {
            console.error('Error approving drawing:', error);
            showNotification({
                title: 'Error',
                message: 'Failed to approve drawing. Please try again.',
                type: 'error'
            });
        }
    };
    
    const deleteDrawing = async (drawingId) => {
        try {
            const response = await fetch(`${API_URL}/drawings/${drawingId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Failed to delete drawing');
            }
            
            showNotification({
                title: 'Drawing Deleted',
                message: 'The drawing has been deleted successfully.',
                type: 'success'
            });
            
            // Reload drawings
            loadDrawings();
            
            return true;
        } catch (error) {
            console.error('Error deleting drawing:', error);
            showNotification({
                title: 'Error',
                message: error.message || 'Failed to delete drawing. Please try again.',
                type: 'error'
            });
            throw error; // Re-throw to allow the calling function to handle it
        }
    };
    
    // Open delete confirmation modal
    const openDeleteConfirmModal = (itemId, itemType) => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const confirmBtn = document.getElementById('confirm-btn');
        const cancelBtn = document.getElementById('cancel-btn');
        
        // Set content based on item type
        titleEl.textContent = `Delete ${itemType.charAt(0).toUpperCase() + itemType.slice(1)}`;
        messageEl.textContent = `Are you sure you want to delete this ${itemType}? This action cannot be undone.`;
        
        // Clean up previous event listeners
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // Set up new event listeners
        newConfirmBtn.addEventListener('click', async () => {
            // Show loading state on the button
            newConfirmBtn.disabled = true;
            newConfirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
            
            try {
                if (itemType === 'message') {
                    await deleteMessage(itemId);
                } else if (itemType === 'drawing') {
                    await deleteDrawing(itemId);
                }
                // Hide modal after successful deletion
                modal.classList.remove('active');
            } catch (error) {
                // Reset button if error occurs
                newConfirmBtn.disabled = false;
                newConfirmBtn.innerHTML = 'Confirm';
                
                // Show error notification
                showNotification({
                    title: 'Error',
                    message: `Failed to delete ${itemType}. Please try again.`,
                    type: 'error'
                });
            }
        });
        
        newCancelBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
        
        // Show modal
        modal.classList.add('active');
        
        // Close modal when clicking outside or on close button
        const handleModalClick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                modal.removeEventListener('click', handleModalClick);
            }
        };
        
        modal.addEventListener('click', handleModalClick);
        
        const closeBtn = modal.querySelector('.modal-close');
        const handleCloseClick = () => {
            modal.classList.remove('active');
            closeBtn.removeEventListener('click', handleCloseClick);
        };
        
        closeBtn.addEventListener('click', handleCloseClick);
    };
    
    // Show notification
    const showNotification = ({ title, message, type = 'info', duration = 5000 }) => {
        const container = document.querySelector('.notification-container');
        
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        // Icon based on type
        let icon;
        switch (type) {
            case 'success':
                icon = 'fas fa-check-circle';
                break;
            case 'error':
                icon = 'fas fa-exclamation-circle';
                break;
            case 'warning':
                icon = 'fas fa-exclamation-triangle';
                break;
            default:
                icon = 'fas fa-info-circle';
        }
        
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="${icon}"></i>
            </div>
            <div class="notification-content">
                <div class="notification-title">${title}</div>
                <p class="notification-message">${message}</p>
            </div>
            <button class="notification-close" aria-label="Close notification">
                <i class="fas fa-times"></i>
            </button>
            <div class="notification-progress"></div>
        `;
        
        // Add to container
        container.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
        
        // Set up close button
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            closeNotification(notification);
        });
        
        // Auto-close after duration
        const timeoutId = setTimeout(() => {
            closeNotification(notification);
        }, duration);
        
        // Store timeout ID to cancel if manually closed
        notification.dataset.timeoutId = timeoutId;
        
        // Function to close notification
        function closeNotification(notif) {
            // Clear timeout if it exists
            if (notif.dataset.timeoutId) {
                clearTimeout(parseInt(notif.dataset.timeoutId));
            }
            
            // Remove show class to trigger exit animation
            notif.classList.remove('show');
            
            // Remove from DOM after animation completes
            setTimeout(() => {
                notif.remove();
            }, 300);
        }
    };
    
    // Initialize page
    const initMessagesPage = async () => {
        try {
            // Load user data
            await loadUserData();
            
            // Load all pages
            const pages = await loadAllPages();
            
            // Populate page select dropdowns
            populatePageSelects(pages);
            
            // Setup tabs
            setupTabs();
            
            // Setup message filter
            setupMessageFilter();
            
            // Load initial data
            loadMessages();
            
            // Check if a specific tab is specified in the URL
            const urlParams = new URLSearchParams(window.location.search);
            const tab = urlParams.get('tab');
            
            if (tab === 'drawings') {
                // Click the drawings tab
                document.querySelector('.tab-btn[data-tab="drawings"]').click();
            }
            
        } catch (error) {
            console.error('Error initializing page:', error);
            showNotification({
                title: 'Error',
                message: 'There was an error initializing the page. Please try refreshing.',
                type: 'error'
            });
        }
    };
    
    // Start the initialization
    initMessagesPage();
});