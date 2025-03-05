// notifications.js
class NotificationSystem {
    constructor() {
      this.container = document.createElement('div');
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
      this.notifications = [];
      this.id = 0;
    }
  
    show(options) {
      const { type = 'info', title, message, duration = 5000 } = options;
      const id = `notification-${this.id++}`;
      
      // Create notification element
      const notification = document.createElement('div');
      notification.id = id;
      notification.className = `notification ${type}`;
      
      // Set icon based on type
      let icon;
      switch(type) {
        case 'success':
          icon = 'fa-check-circle';
          break;
        case 'error':
          icon = 'fa-exclamation-circle';
          break;
        case 'warning':
          icon = 'fa-exclamation-triangle';
          break;
        default:
          icon = 'fa-info-circle';
      }
      
// Create notification content
notification.innerHTML = `
  <div class="notification-icon">
    <i class="fas ${icon}"></i>
  </div>
  <div class="notification-content">
    <div class="notification-title">${title}</div>
    <div class="notification-message">${message}</div>
  </div>
  <button class="notification-close" aria-label="Close">
    <i class="fas fa-times"></i>
  </button>
  <div class="notification-progress">
    <div class="notification-progress-bar"></div>
  </div>
`;

// Add to container
this.container.appendChild(notification);
this.notifications.push({ id, element: notification, timer: null });

// Show notification with animation
setTimeout(() => {
  notification.classList.add('show');
}, 10);

// Setup close button
const closeBtn = notification.querySelector('.notification-close');
closeBtn.addEventListener('click', () => {
  this.close(id);
});

// Auto close after duration
const timer = setTimeout(() => {
  this.close(id);
}, duration);

// Store the timer
const notificationObj = this.notifications.find(n => n.id === id);
if (notificationObj) {
  notificationObj.timer = timer;
}

return id;
}

close(id) {
  const index = this.notifications.findIndex(n => n.id === id);
  if (index !== -1) {
    const { element, timer } = this.notifications[index];
    
    // Clear timeout if exists
    if (timer) {
      clearTimeout(timer);
    }
    
    // Remove animation
    element.classList.remove('show');
    
    // Remove element after animation completes
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
      this.notifications.splice(index, 1);
    }, 400);
  }
}

// Helper methods for common notification types
success(title, message, duration) {
  return this.show({ type: 'success', title, message, duration });
}

error(title, message, duration) {
  return this.show({ type: 'error', title, message, duration });
}

info(title, message, duration) {
  return this.show({ type: 'info', title, message, duration });
}

warning(title, message, duration) {
  return this.show({ type: 'warning', title, message, duration });
}
}

// Initialize the notification system
const notifications = new NotificationSystem();

// Export to global scope for easy access
window.notifications = notifications;