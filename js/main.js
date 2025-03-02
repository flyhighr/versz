document.addEventListener('DOMContentLoaded', function() {
    // Mobile navigation toggle
    const navToggle = document.querySelector('.navbar-toggle');
    const navMenu = document.querySelector('.navbar-menu');
    const navActions = document.querySelector('.navbar-actions');
    
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            navActions.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking outside
    document.addEventListener('click', function(e) {
        if (navMenu && navMenu.classList.contains('active')) {
            if (!e.target.closest('.navbar-toggle') && !e.target.closest('.navbar-menu') && !e.target.closest('.navbar-actions')) {
                navMenu.classList.remove('active');
                navActions.classList.remove('active');
            }
        }
    });
    
    // FAQ accordion
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other answers
            faqItems.forEach(otherItem => {
                otherItem.classList.remove('active');
            });
            
            // Toggle current answer
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const headerOffset = 80;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                if (navMenu && navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    navActions.classList.remove('active');
                }
            }
        });
    });
    
    // Templates slider animation
    const templatesSlider = document.querySelector('.templates-slider');
    if (templatesSlider) {
        let isDown = false;
        let startX;
        let scrollLeft;
        
        // Mouse events for desktop
        templatesSlider.addEventListener('mousedown', (e) => {
            isDown = true;
            templatesSlider.classList.add('active');
            startX = e.pageX - templatesSlider.offsetLeft;
            scrollLeft = templatesSlider.scrollLeft;
            templatesSlider.style.cursor = 'grabbing';
        });
        
        templatesSlider.addEventListener('mouseleave', () => {
            isDown = false;
            templatesSlider.classList.remove('active');
            templatesSlider.style.cursor = 'grab';
        });
        
        templatesSlider.addEventListener('mouseup', () => {
            isDown = false;
            templatesSlider.classList.remove('active');
            templatesSlider.style.cursor = 'grab';
        });
        
        templatesSlider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - templatesSlider.offsetLeft;
            const walk = (x - startX) * 2;
            templatesSlider.scrollLeft = scrollLeft - walk;
        });
        
        // Touch events for mobile
        templatesSlider.addEventListener('touchstart', (e) => {
            isDown = true;
            templatesSlider.classList.add('active');
            startX = e.touches[0].pageX - templatesSlider.offsetLeft;
            scrollLeft = templatesSlider.scrollLeft;
            stopAutoScroll();
        });
        
        templatesSlider.addEventListener('touchend', () => {
            isDown = false;
            templatesSlider.classList.remove('active');
            startAutoScroll();
        });
        
        templatesSlider.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            const x = e.touches[0].pageX - templatesSlider.offsetLeft;
            const walk = (x - startX) * 2;
            templatesSlider.scrollLeft = scrollLeft - walk;
        });
        
        // Auto scroll for mobile
        let scrollInterval;
        const autoScrollSpeed = 1;
        const autoScrollDelay = 20;
        
        const startAutoScroll = () => {
            if (window.innerWidth < 768) {
                scrollInterval = setInterval(() => {
                    templatesSlider.scrollLeft += autoScrollSpeed;
                    if (templatesSlider.scrollLeft >= (templatesSlider.scrollWidth - templatesSlider.clientWidth)) {
                        // Reset to beginning with smooth transition
                        const resetScroll = setInterval(() => {
                            templatesSlider.scrollLeft -= 5;
                            if (templatesSlider.scrollLeft <= 0) {
                                clearInterval(resetScroll);
                            }
                        }, 10);
                    }
                }, autoScrollDelay);
            }
        };
        
        const stopAutoScroll = () => {
            clearInterval(scrollInterval);
        };
        
        // Initialize auto-scroll
        startAutoScroll();
        
        // Stop auto-scroll on user interaction
        templatesSlider.addEventListener('mouseenter', stopAutoScroll);
        templatesSlider.addEventListener('mouseleave', startAutoScroll);
        
        // Handle resize events
        window.addEventListener('resize', () => {
            stopAutoScroll();
            startAutoScroll();
        });
    }
    
    // Animate elements when they come into view
    const observeElements = () => {
        const elements = document.querySelectorAll('.feature-card, .template-card, .section-title, .cta-content, .faq-item');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate');
                    observer.unobserve(entry.target); // Stop observing once animated
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -100px 0px'
        });
        
        elements.forEach(element => {
            observer.observe(element);
        });
    };
    
    // Hero animation
    const animateHero = () => {
        const heroContent = document.querySelector('.hero-content');
        const profileCard = document.querySelector('.profile-card');
        
        if (heroContent) {
            setTimeout(() => {
                heroContent.classList.add('animate');
            }, 300);
        }
        
        if (profileCard) {
            setTimeout(() => {
                profileCard.classList.add('animate');
            }, 600);
        }
    };
    
    // Initialize animations
    observeElements();
    animateHero();
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        .feature-card, .template-card, .section-title, .cta-content, .faq-item, .hero-content, .profile-card {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        
        .feature-card.animate, .template-card.animate, .section-title.animate, .cta-content.animate, .faq-item.animate {
            opacity: 1;
            transform: translateY(0);
        }
        
        .hero-content.animate {
            opacity: 1;
            transform: translateY(0);
        }
        
        .profile-card.animate {
            opacity: 1;
            transform: translateY(0);
        }
        
        .templates-slider {
            cursor: grab;
        }
        
        .templates-slider.active {
            cursor: grabbing;
        }
        
        .feature-card:nth-child(2) {
            transition-delay: 0.1s;
        }
        
        .feature-card:nth-child(3) {
            transition-delay: 0.2s;
        }
        
        .feature-card:nth-child(4) {
            transition-delay: 0.3s;
        }
        
        .feature-card:nth-child(5) {
            transition-delay: 0.4s;
        }
        
        .feature-card:nth-child(6) {
            transition-delay: 0.5s;
        }
        
        .template-card:nth-child(2) {
            transition-delay: 0.1s;
        }
        
        .template-card:nth-child(3) {
            transition-delay: 0.2s;
        }
        
        .faq-item:nth-child(2) {
            transition-delay: 0.1s;
        }
        
        .faq-item:nth-child(3) {
            transition-delay: 0.2s;
        }
        
        .faq-item:nth-child(4) {
            transition-delay: 0.3s;
        }
    `;
    document.head.appendChild(style);
});