(function suppressPwaIcon() {
    function setBlankIcon(rel) {
        var existing = document.querySelector('link[rel="' + rel + '"]');
        if (existing) {
            existing.setAttribute('href', 'data:,');
            return;
        }
        if (!document.head) return;
        var link = document.createElement('link');
        link.rel = rel;
        link.href = 'data:,';
        document.head.appendChild(link);
    }

    if (document.head) {
        setBlankIcon('icon');
        setBlankIcon('shortcut icon');
        setBlankIcon('apple-touch-icon');
        document.querySelectorAll('link[rel="manifest"]').forEach(function(el) {
            el.remove();
        });
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            registrations.forEach(function(registration) {
                registration.unregister();
            });
        }).catch(function() {});
    }
})();

/**
 * Nested scroll lock for modals, cart drawer, mobile nav.
 * Use KNS.lockScroll() / KNS.unlockScroll() (refcount-safe).
 * Optional reason: 'modal' | 'cart' | 'nav' — toggles body classes.
 */
(function initScrollLock(global) {
    var locks = 0;
    var scrollY = 0;
    var reasons = Object.create(null);

    function applyClasses() {
        var body = document.body;
        if (!body) return;
        body.classList.toggle('kns-scroll-locked', locks > 0);
        body.classList.toggle('kns-modal-open', !!reasons.modal);
        body.classList.toggle('kns-cart-open', !!reasons.cart);
        body.classList.toggle('kns-nav-open', !!reasons.nav);
        document.documentElement.classList.toggle('kns-scroll-locked', locks > 0);
    }

    function lockScroll(reason) {
        if (locks === 0) {
            scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
            if (document.body) {
                document.body.style.top = '-' + scrollY + 'px';
            }
        }
        locks += 1;
        if (reason) {
            reasons[reason] = (reasons[reason] || 0) + 1;
        }
        applyClasses();
    }

    function unlockScroll(reason) {
        if (locks <= 0) {
            locks = 0;
            return;
        }
        locks -= 1;
        if (reason && reasons[reason]) {
            reasons[reason] -= 1;
            if (reasons[reason] <= 0) delete reasons[reason];
        }
        if (locks <= 0) {
            locks = 0;
            reasons = Object.create(null);
            if (document.body) {
                document.body.style.top = '';
            }
            applyClasses();
            window.scrollTo(0, scrollY);
        } else {
            applyClasses();
        }
    }

    global.KNS = global.KNS || {};
    global.KNS.lockScroll = lockScroll;
    global.KNS.unlockScroll = unlockScroll;
})(typeof window !== 'undefined' ? window : this);

(function initPageLoader() {
    var MIN_VISIBLE_MS = 280;
    var shownAt = 0;
    var overlay = null;

    function ensureOverlay() {
        if (overlay && document.body.contains(overlay)) return overlay;
        overlay = document.getElementById('pageLoader');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'pageLoader';
            overlay.className = 'page-loader';
            overlay.setAttribute('role', 'status');
            overlay.setAttribute('aria-live', 'polite');
            overlay.setAttribute('aria-busy', 'true');
            overlay.innerHTML =
                '<div class="page-loader__inner">' +
                    '<div class="loader" aria-hidden="true"></div>' +
                    '<p class="page-loader__label">Loading…</p>' +
                '</div>';
            if (document.body) {
                document.body.insertBefore(overlay, document.body.firstChild);
            }
        }
        return overlay;
    }

    function showLoader(label) {
        var el = ensureOverlay();
        if (!el) return;
        var labelEl = el.querySelector('.page-loader__label');
        if (labelEl && typeof label === 'string' && label) {
            labelEl.textContent = label;
        }
        el.classList.remove('is-hidden');
        el.setAttribute('aria-busy', 'true');
        shownAt = Date.now();
        if (document.body) {
            document.body.classList.add('is-page-loading');
        }
    }

    function hideLoader() {
        var el = overlay || document.getElementById('pageLoader');
        if (!el) {
            if (document.body) document.body.classList.remove('is-page-loading');
            return;
        }
        var elapsed = Date.now() - shownAt;
        var wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
        window.setTimeout(function() {
            el.classList.add('is-hidden');
            el.setAttribute('aria-busy', 'false');
            if (document.body) document.body.classList.remove('is-page-loading');
        }, wait);
    }

    window.KNS = window.KNS || {};
    window.KNS.showLoader = showLoader;
    window.KNS.hideLoader = hideLoader;

    function start() {
        if (!document.body) {
            document.addEventListener('DOMContentLoaded', start);
            return;
        }

        // Catalog pages use an inline spinner in the course list area only
        var useInlineCatalogLoader =
            document.body.classList.contains('page-online-courses') ||
            document.body.classList.contains('page-trainings');

        if (useInlineCatalogLoader) {
            hideLoader();
            document.addEventListener('kns-online-courses-loaded', hideLoader, { once: true });
            document.addEventListener('kns-training-catalog-ready', hideLoader, { once: true });
            return;
        }

        showLoader('Loading…');

        if (document.readyState === 'complete') {
            hideLoader();
        } else {
            window.addEventListener('load', hideLoader, { once: true });
            // Fallback if load is delayed by a hanging asset
            window.setTimeout(hideLoader, 8000);
        }
    }

    start();
})();

document.addEventListener('DOMContentLoaded', function() {
    // must match the tablet/mobile nav breakpoint in styles.css
    const NAV_OVERLAY_MAX_WIDTH = 1024;

    ensureTrainingsNavLink();
    ensureSideButtons();
    ensureChatbotWidget();

    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.querySelector('.main-nav');
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const body = document.body;
    
    // Store scroll position when menu opens
    function lockBodyScroll() {
        if (typeof KNS !== 'undefined' && KNS.lockScroll) {
            KNS.lockScroll('nav');
        } else {
            body.classList.add('kns-scroll-locked', 'kns-nav-open');
        }
    }
    
    function unlockBodyScroll() {
        if (typeof KNS !== 'undefined' && KNS.unlockScroll) {
            KNS.unlockScroll('nav');
        } else {
            body.classList.remove('kns-scroll-locked', 'kns-nav-open');
        }
    }
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            if (mainNav) {
                mainNav.classList.toggle('active');
            }
            if (sidebar) {
                sidebar.classList.toggle('active');
            }
            this.classList.toggle('active');
            if (mainNav && mainNav.classList.contains('active')) {
                lockBodyScroll();
            } else {
                unlockBodyScroll();
            }
        });
    }
    
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= NAV_OVERLAY_MAX_WIDTH) {
            if (mainNav && mainNav.classList.contains('active')) {
                if (!mainNav.contains(e.target) && mobileMenuToggle && !mobileMenuToggle.contains(e.target)) {
                    mainNav.classList.remove('active');
                    if (mobileMenuToggle) {
                        mobileMenuToggle.classList.remove('active');
                    }
                    unlockBodyScroll();
                }
            }
            if (sidebar && sidebar.classList.contains('active')) {
                if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    sidebar.classList.remove('active');
                    if (mobileMenuToggle) {
                        mobileMenuToggle.classList.remove('active');
                    }
                    unlockBodyScroll();
                }
            }
        }
    });
    
    if (mainNav) {
        const dropdownParents = mainNav.querySelectorAll('.has-dropdown > a');
        dropdownParents.forEach(parentLink => {
            parentLink.addEventListener('click', function(e) {
                if (window.innerWidth <= NAV_OVERLAY_MAX_WIDTH) {
                    e.preventDefault();
                    const parent = this.parentElement;
                    const dropdown = parent.querySelector('.dropdown-menu');
                    
                    dropdownParents.forEach(otherParent => {
                        if (otherParent !== this) {
                            const otherParentEl = otherParent.parentElement;
                            const otherDropdown = otherParentEl.querySelector('.dropdown-menu');
                            if (otherDropdown) {
                                otherDropdown.style.display = 'none';
                                otherParentEl.classList.remove('dropdown-open');
                            }
                        }
                    });
                    
                    if (dropdown) {
                        const isOpen = dropdown.style.display === 'block';
                        dropdown.style.display = isOpen ? 'none' : 'block';
                        parent.classList.toggle('dropdown-open', !isOpen);
                    }
                }
            });
        });
        
        const navLinks = mainNav.querySelectorAll('a:not(.has-dropdown > a)');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= NAV_OVERLAY_MAX_WIDTH) {
                    mainNav.classList.remove('active');
                    if (mobileMenuToggle) {
                        mobileMenuToggle.classList.remove('active');
                    }
                    unlockBodyScroll();
                }
            });
        });
        
        const dropdownLinks = mainNav.querySelectorAll('.dropdown-menu a');
        dropdownLinks.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= NAV_OVERLAY_MAX_WIDTH) {
                    setTimeout(() => {
                        mainNav.classList.remove('active');
                        if (mobileMenuToggle) {
                            mobileMenuToggle.classList.remove('active');
                        }
                        unlockBodyScroll();
                    }, 100);
                }
            });
        });
    }
    
    if (mainContent && sidebar) {
        mainContent.addEventListener('click', function() {
            if (window.innerWidth <= NAV_OVERLAY_MAX_WIDTH && sidebar.classList.contains('active')) {
                sidebar.classList.remove('active');
                if (mobileMenuToggle) {
                    mobileMenuToggle.classList.remove('active');
                }
                unlockBodyScroll();
            }
        });
    }
    
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
        const link = item.querySelector('.sidebar-link');
        const submenu = item.querySelector('.sidebar-submenu');
        
        if (link && submenu && window.innerWidth <= NAV_OVERLAY_MAX_WIDTH) {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                item.classList.toggle('active');
            });
        }
    });
    
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > NAV_OVERLAY_MAX_WIDTH) {
                if (mainNav) {
                    mainNav.classList.remove('active');
                }
                if (sidebar) {
                    sidebar.classList.remove('active');
                }
                if (mobileMenuToggle) {
                    mobileMenuToggle.classList.remove('active');
                }
                unlockBodyScroll();
            }
        }, 250);
    });
    
    const applicationForm = document.querySelector('.application-form');
    
    if (applicationForm) {
        applicationForm.addEventListener('submit', function(e) {
        });
    }
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            const hash = href.substring(1);
            
            if (hash === 'diploma' || hash === 'certificate' || hash === 'train-certify') {
                return;
            }
            
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
    
    const programmeSearchInput = document.getElementById('programmeSearch');
    const programmeSearchPageInput = document.getElementById('programmeSearchPage');
    const onlineCourseSearchInput = document.getElementById('onlineCourseSearch');
    const searchButtons = document.querySelectorAll('.search-button');
    
    function performSearch(searchInput) {
        if (!searchInput) return;
        
        const searchTerm = searchInput.value.toLowerCase().trim();
        const courseCards = document.querySelectorAll('.course-card');
        const schoolCards = document.querySelectorAll('.school-card');
        
        if (courseCards.length > 0) {
            courseCards.forEach(card => {
                const courseName = card.querySelector('.course-name')?.textContent.toLowerCase() || '';
                const courseSummary = card.querySelector('.course-summary')?.textContent.toLowerCase() || '';
                const courseMeta = card.querySelector('.course-meta')?.textContent.toLowerCase() || '';
                
                const matches = courseName.includes(searchTerm) || 
                               courseSummary.includes(searchTerm) || 
                               courseMeta.includes(searchTerm);
                
                if (searchTerm === '' || matches) {
                    card.style.display = '';
                    if (searchTerm && matches) {
                        card.style.border = '2px solid var(--primary-color)';
                        card.style.boxShadow = '0 4px 12px rgba(26, 77, 122, 0.2)';
                    } else {
                        card.style.border = '';
                        card.style.boxShadow = '';
                    }
                } else {
                    card.style.display = 'none';
                }
            });
            
            const programmeCategories = document.querySelectorAll('.programme-category, .programme-subcategory');
            programmeCategories.forEach(category => {
                const visibleCards = Array.from(category.querySelectorAll('.course-card'))
                    .filter(card => card.style.display !== 'none');
                if (visibleCards.length === 0 && searchTerm !== '') {
                    category.style.display = 'none';
                } else {
                    category.style.display = '';
                }
            });
        }
        
        if (schoolCards.length > 0) {
            schoolCards.forEach(card => {
                const schoolName = card.querySelector('.school-name')?.textContent.toLowerCase() || '';
                const schoolDescription = card.querySelector('.school-description')?.textContent.toLowerCase() || '';
                const programmeItems = Array.from(card.querySelectorAll('.programme-item'))
                    .map(item => item.textContent.toLowerCase());
                
                const matches = schoolName.includes(searchTerm) || 
                               schoolDescription.includes(searchTerm) ||
                               programmeItems.some(item => item.includes(searchTerm));
                
                if (searchTerm === '' || matches) {
                    card.style.display = '';
                    if (searchTerm && matches) {
                        card.style.border = '2px solid var(--primary-color)';
                        card.style.boxShadow = '0 8px 24px rgba(26, 77, 122, 0.2)';
                    } else {
                        card.style.border = '';
                        card.style.boxShadow = '';
                    }
                } else {
                    card.style.display = 'none';
                }
            });
        }
    }
    
    if (programmeSearchInput) {
        programmeSearchInput.addEventListener('input', function() {
            performSearch(this);
        });
        
        programmeSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch(this);
            }
        });
    }
    
    if (programmeSearchPageInput) {
        programmeSearchPageInput.addEventListener('input', function() {
            performSearch(this);
        });
        
        programmeSearchPageInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch(this);
            }
        });
    }
    
    const onlineCategoryFilterButtons = document.querySelectorAll('[data-online-category-filter]');
    const onlineCoursesEmptyHint = document.getElementById('onlineCoursesEmptyHint');
    const onlineCoursesFilterStatus = document.getElementById('onlineCoursesFilterStatus');
    let activeOnlineCategory = 'all';

    const ONLINE_CATEGORY_LABELS = {
        business: 'business management project entrepreneurship accounting quickbooks esb',
        ict: 'ict digital literacy cybersecurity data analysis comptia hardware graphic design ai essentials',
        microsoft: 'microsoft office specialist mos 2019 azure ai courses'
    };

    function applyOnlineCoursesFilter() {
        if (!document.body.classList.contains('page-online-courses')) return;

        const searchTerm = (onlineCourseSearchInput?.value || '').toLowerCase().trim();
        const cards = document.querySelectorAll('.online-course-card');
        const sections = document.querySelectorAll('.online-course-category-block');

        let visibleCount = 0;

        cards.forEach((card) => {
            const slug = card.getAttribute('data-online-category') || '';
            const catOk = activeOnlineCategory === 'all' || slug === activeOnlineCategory;

            const title = card.querySelector('.online-course-title')?.textContent.toLowerCase() || '';
            const dataCourse = (card.getAttribute('data-course') || '').toLowerCase();
            const enroll = (
                card.querySelector('[data-course-name]')?.getAttribute('data-course-name') ||
                ''
            ).toLowerCase();
            const catWords = (ONLINE_CATEGORY_LABELS[slug] || '').toLowerCase();
            const haystack = `${title} ${dataCourse} ${enroll} ${slug} ${catWords}`;

            const searchOk = searchTerm === '' || haystack.includes(searchTerm);
            const show = catOk && searchOk;
            card.style.display = show ? '' : 'none';
            if (show) visibleCount += 1;
        });

        sections.forEach((section) => {
            const any = Array.from(section.querySelectorAll('.online-course-card')).some(
                (c) => c.style.display !== 'none'
            );
            section.style.display = any ? '' : 'none';
        });

        const catalogErrEl = document.getElementById('onlineCoursesCatalogError');
        const catalogLoadFailed =
            catalogErrEl && !catalogErrEl.hidden && (catalogErrEl.textContent || '').trim().length > 0;
        const catalogStillLoading =
            document.querySelector('#onlineCoursesCategoryRoot .online-courses-catalog-loading') !== null;

        if (onlineCoursesEmptyHint) {
            onlineCoursesEmptyHint.hidden = visibleCount > 0 || catalogLoadFailed || catalogStillLoading;
        }
        if (onlineCoursesFilterStatus) {
            onlineCoursesFilterStatus.textContent =
                visibleCount === 0
                    ? 'No courses match.'
                    : `Showing ${visibleCount} of ${cards.length} courses.`;
        }
    }

    if (onlineCourseSearchInput) {
        onlineCourseSearchInput.addEventListener('input', applyOnlineCoursesFilter);
        onlineCourseSearchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    }

    onlineCategoryFilterButtons.forEach((btn) => {
        btn.addEventListener('click', function() {
            activeOnlineCategory = this.getAttribute('data-online-category-filter') || 'all';
            onlineCategoryFilterButtons.forEach((b) => {
                b.classList.toggle('is-active', b === this);
            });
            applyOnlineCoursesFilter();
        });
    });

    document.addEventListener('kns-online-courses-loaded', function () {
        if (document.body.classList.contains('page-online-courses')) {
            applyOnlineCoursesFilter();
        }
    });

    if (document.body.classList.contains('page-online-courses')) {
        applyOnlineCoursesFilter();
    }
    
    searchButtons.forEach(button => {
        button.addEventListener('click', function() {
            const searchInput = this.closest('.search-wrapper')?.querySelector('.programme-search-input');
            if (searchInput) {
                performSearch(searchInput);
            }
        });
    });
    
    function filterProgrammesByType() {
        const hash = window.location.hash.substring(1);
        const courseCards = document.querySelectorAll('.course-card');
        const programmeCategories = document.querySelectorAll('.programme-category');
        const programmeSubcategories = document.querySelectorAll('.programme-subcategory');
        
        programmeCategories.forEach(category => {
            category.style.display = '';
        });
        programmeSubcategories.forEach(subcategory => {
            subcategory.style.display = '';
        });
        
        if (hash === 'train-certify') {
            courseCards.forEach(card => {
                card.style.display = 'none';
            });
            programmeCategories.forEach(category => {
                category.style.display = 'none';
            });
            programmeSubcategories.forEach(subcategory => {
                subcategory.style.display = 'none';
            });
            return;
        }
        
        if (hash === 'diploma') {
            courseCards.forEach(card => {
                const programmeType = card.getAttribute('data-programme-type');
                if (programmeType === 'diploma') {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        } else if (hash === 'certificate') {
            courseCards.forEach(card => {
                const programmeType = card.getAttribute('data-programme-type');
                if (programmeType === 'certificate') {
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        } else {
            courseCards.forEach(card => {
                card.style.display = '';
            });
        }
        
        programmeSubcategories.forEach(subcategory => {
            const visibleCards = Array.from(subcategory.querySelectorAll('.course-card'))
                .filter(card => card.style.display !== 'none');
            if (visibleCards.length === 0) {
                subcategory.style.display = 'none';
            }
        });
        
        programmeCategories.forEach(category => {
            const visibleSubcategories = Array.from(category.querySelectorAll('.programme-subcategory'))
                .filter(sub => sub.style.display !== 'none');
            if (visibleSubcategories.length === 0) {
                category.style.display = 'none';
            }
        });
        
        const contentSection = document.querySelector('.content-section');
        if (contentSection && (hash === 'diploma' || hash === 'certificate' || hash === 'train-certify')) {
            setTimeout(() => {
                contentSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }, 100);
        }
    }
    
    filterProgrammesByType();
    
    window.addEventListener('hashchange', function() {
        filterProgrammesByType();
    });
    
    if (window.location.hash) {
        setTimeout(filterProgrammesByType, 100);
    }
    
    const enrollmentModal = document.getElementById('enrollmentModal');
    const enrollmentForm = document.getElementById('enrollmentForm');
    const enrollCourseInput = document.getElementById('enroll-course');
    const modalClose = document.querySelector('.modal-close');
    const cancelEnrollmentBtn = document.getElementById('cancelEnrollment');
    const applyButtons = document.querySelectorAll('.btn-apply');
    
    applyButtons.forEach(button => {
        button.addEventListener('click', function() {
            const courseName = this.getAttribute('data-course-name');
            if (enrollCourseInput) {
                enrollCourseInput.value = courseName;
            }
            if (enrollmentModal) {
                enrollmentModal.classList.add('active');
                if (typeof KNS !== 'undefined' && KNS.lockScroll) {
                    KNS.lockScroll('modal');
                } else {
                    document.body.style.overflow = 'hidden';
                }
            }
        });
    });
    
    function closeEnrollmentModal() {
        if (enrollmentModal) {
            enrollmentModal.classList.remove('active');
            if (typeof KNS !== 'undefined' && KNS.unlockScroll) {
                KNS.unlockScroll('modal');
            } else {
                document.body.style.overflow = '';
            }
            if (enrollmentForm) {
                enrollmentForm.reset();
            }
        }
    }
    
    if (modalClose) {
        modalClose.addEventListener('click', closeEnrollmentModal);
    }
    
    if (cancelEnrollmentBtn) {
        cancelEnrollmentBtn.addEventListener('click', closeEnrollmentModal);
    }
    
    if (enrollmentModal) {
        enrollmentModal.addEventListener('click', function(e) {
            if (e.target === enrollmentModal) {
                closeEnrollmentModal();
            }
        });
    }
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && enrollmentModal && enrollmentModal.classList.contains('active')) {
            closeEnrollmentModal();
        }
    });
    
    if (enrollmentForm) {
        enrollmentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(enrollmentForm);
            const courseName = formData.get('course');
            const firstName = formData.get('first-name');
            const lastName = formData.get('last-name');
            const email = formData.get('email');
            const phone = formData.get('phone');
            const paymentMethod = formData.get('payment-method');
            const mobileNumber = formData.get('mobile-number');
            
            const submitBtn = enrollmentForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.textContent : '';
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';
            }
            
            try {
                const apiUrl = (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:3000') + '/api/enrollments';
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        courseName: courseName,
                        firstName: firstName,
                        lastName: lastName,
                        email: email,
                        phone: phone || null,
                        paymentMethod: paymentMethod || null,
                        mobileNumber: mobileNumber || null,
                        enrollmentFee: 'Le1,000'
                    })
                });
                
                const result = await response.json();
                
                if (response.ok && result.success) {
                    alert('Thank you for your enrollment! We will contact you shortly with payment instructions.\n\nCourse: ' + courseName + '\nEnrollment Fee: Le1,000\nPayment Method: ' + paymentMethod);
                    closeEnrollmentModal();
                } else {
                    throw new Error(result.error || 'Failed to submit enrollment');
                }
            } catch (error) {
                console.error('Error submitting enrollment:', error);
                alert('Thank you for your enrollment! We will contact you shortly with payment instructions.\n\nCourse: ' + courseName + '\nEnrollment Fee: Le1,000\nPayment Method: ' + paymentMethod);
                closeEnrollmentModal();
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }
            }
        });
    }
    
    const partnersScrollWrapper = document.getElementById('partnersScroll');
    if (partnersScrollWrapper) {
        const partnerLogos = partnersScrollWrapper.querySelectorAll('.partner-logo');
        
        partnerLogos.forEach(logo => {
            logo.addEventListener('mousedown', function() {
                partnersScrollWrapper.classList.add('paused');
            });
            
            logo.addEventListener('touchstart', function() {
                partnersScrollWrapper.classList.add('paused');
            });
            
            logo.addEventListener('mouseup', function() {
                partnersScrollWrapper.classList.remove('paused');
            });
            
            logo.addEventListener('touchend', function() {
                partnersScrollWrapper.classList.remove('paused');
            });
            
            logo.addEventListener('mouseleave', function() {
                partnersScrollWrapper.classList.remove('paused');
            });
        });
        
        partnersScrollWrapper.addEventListener('mousedown', function() {
            partnersScrollWrapper.classList.add('paused');
        });
        
        partnersScrollWrapper.addEventListener('mouseup', function() {
            partnersScrollWrapper.classList.remove('paused');
        });
        
        partnersScrollWrapper.addEventListener('touchstart', function() {
            partnersScrollWrapper.classList.add('paused');
        });
        
        partnersScrollWrapper.addEventListener('touchend', function() {
            partnersScrollWrapper.classList.remove('paused');
        });
    }
});

/** Insert Trainings into the main nav when a page is missing it. */
function ensureTrainingsNavLink() {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return;

    const existing = Array.from(navMenu.querySelectorAll('a')).find(function(link) {
        const href = (link.getAttribute('href') || '').toLowerCase();
        return href.indexOf('trainings.html') !== -1 || link.textContent.trim().toLowerCase() === 'trainings';
    });
    if (existing) return;

    const trainingsItem = document.createElement('li');
    trainingsItem.innerHTML = '<a href="trainings.html">Trainings</a>';

    const corporateLink = Array.from(navMenu.querySelectorAll('a')).find(function(link) {
        const href = (link.getAttribute('href') || '').toLowerCase();
        return href.indexOf('corporate-training.html') !== -1;
    });
    if (corporateLink && corporateLink.parentElement) {
        corporateLink.parentElement.insertAdjacentElement('afterend', trainingsItem);
        return;
    }

    const certificationsLink = Array.from(navMenu.querySelectorAll('a')).find(function(link) {
        const href = (link.getAttribute('href') || '').toLowerCase();
        return href.indexOf('certifications.html') !== -1;
    });
    if (certificationsLink && certificationsLink.parentElement) {
        certificationsLink.parentElement.insertAdjacentElement('beforebegin', trainingsItem);
        return;
    }

    navMenu.appendChild(trainingsItem);
}

/** Inject Apply / Requirements / Online Courses CTAs when missing. */
function ensureSideButtons() {
    if (document.querySelector('.side-buttons-container')) return;

    const container = document.createElement('div');
    container.className = 'side-buttons-container';
    container.innerHTML =
        '<a href="https://webportal.kns.edu.sl/register" target="_blank" class="side-btn side-btn-apply" title="Apply Now">' +
            '<span class="side-btn-text">Apply here</span>' +
            '<svg class="side-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M5 12h14M12 5l7 7-7 7"/>' +
            '</svg>' +
        '</a>' +
        '<a href="admissions.html#requirements" class="side-btn side-btn-requirements" title="View Requirements">' +
            '<span class="side-btn-text">Requirements</span>' +
            '<svg class="side-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M9 12l2 2 4-4M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"/>' +
            '</svg>' +
        '</a>' +
        '<a href="online-courses.html" class="side-btn side-btn-online" title="Online Courses">' +
            '<span class="side-btn-text">Online Courses</span>' +
            '<svg class="side-btn-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />' +
                '<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />' +
            '</svg>' +
        '</a>';
    document.body.appendChild(container);
}

/** Inject chatbot + WhatsApp markup and load chatbot.js when needed. */
function ensureChatbotWidget() {
    if (!document.getElementById('chatbotToggle')) {
        const container = document.createElement('div');
        container.className = 'chatbot-container';
        container.innerHTML =
            '<a href="https://wa.me/23279422442" target="_blank" id="whatsappSupportBtn" aria-label="Contact us on WhatsApp" title="Chat with us on WhatsApp">' +
                '<svg viewBox="0 0 24 24" fill="currentColor">' +
                    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>' +
                '</svg>' +
            '</a>' +
            '<button id="chatbotToggle" aria-label="Open chatbot" title="Chat with us">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                    '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' +
                '</svg>' +
            '</button>' +
            '<div id="chatbotWidget">' +
                '<div class="chatbot-header">' +
                    '<div class="chatbot-header-info">' +
                        '<span class="chatbot-status"></span>' +
                        '<h3>KNS College Support</h3>' +
                    '</div>' +
                    '<div class="chatbot-header-actions">' +
                        '<button id="chatbotMinimize" aria-label="Minimize chatbot" title="Minimize">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                                '<line x1="5" y1="12" x2="19" y2="12"></line>' +
                            '</svg>' +
                        '</button>' +
                        '<button id="chatbotClose" aria-label="Close chatbot" title="Close and start new conversation">' +
                            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                                '<line x1="18" y1="6" x2="6" y2="18"></line>' +
                                '<line x1="6" y1="6" x2="18" y2="18"></line>' +
                            '</svg>' +
                        '</button>' +
                    '</div>' +
                '</div>' +
                '<div class="chat-messages" id="chatMessages"></div>' +
                '<div class="chatbot-input-area">' +
                    '<input type="text" id="chatInput" placeholder="Type your message..." autocomplete="off">' +
                    '<button id="chatSendBtn" aria-label="Send message">' +
                        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
                            '<line x1="22" y1="2" x2="11" y2="13"></line>' +
                            '<polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>' +
                        '</svg>' +
                    '</button>' +
                '</div>' +
            '</div>';
        document.body.appendChild(container);
    }

    if (document.querySelector('script[src*="chatbot.js"]') || window.__knsChatbotScriptLoading) {
        return;
    }

    window.__knsChatbotScriptLoading = true;
    const script = document.createElement('script');
    script.src = 'chatbot.js';
    script.async = false;
    document.body.appendChild(script);
}

