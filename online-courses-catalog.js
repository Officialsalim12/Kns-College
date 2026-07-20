(function () {    'use strict';

    if (!document.body.classList.contains('page-online-courses')) {
        return;
    }

    if (typeof CONFIG === 'undefined' || !CONFIG.API_BASE_URL || !CONFIG.ENDPOINTS?.ONLINE_COURSES) {
        return;
    }

    const apiUrl =
        typeof CONFIG.buildApiUrl === 'function'
            ? CONFIG.buildApiUrl(CONFIG.ENDPOINTS.ONLINE_COURSES)
            : String(CONFIG.API_BASE_URL || '').replace(/\/+$/, '') + CONFIG.ENDPOINTS.ONLINE_COURSES;

    const root = document.getElementById('onlineCoursesCategoryRoot');
    const errEl = document.getElementById('onlineCoursesCatalogError');

    function setError(msg) {
        if (!errEl) return;
        errEl.textContent = msg || '';
        errEl.hidden = !msg;
    }

    function parseJsonResponse(res) {
        return res.text().then((text) => {
            let data = {};
            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    data = {};
                }
            }
            const ok = res.ok || res.status === 304;
            return { ok, data, status: res.status };
        });
    }

    const SVG_NS = 'http://www.w3.org/2000/svg';

    function svgIconBook() {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('aria-hidden', 'true');
        ['M4 19.5A2.5 2.5 0 0 1 6.5 17H20', 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'].forEach((d) => {
            const p = document.createElementNS(SVG_NS, 'path');
            p.setAttribute('d', d);
            svg.appendChild(p);
        });
        return svg;
    }

    function svgIconClock() {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', '18');
        svg.setAttribute('height', '18');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('aria-hidden', 'true');
        const c = document.createElementNS(SVG_NS, 'circle');
        c.setAttribute('cx', '12');
        c.setAttribute('cy', '12');
        c.setAttribute('r', '10');
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', 'M12 6v6l4 2');
        svg.appendChild(c);
        svg.appendChild(p);
        return svg;
    }

    function svgIconStarSmall() {
        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('width', '14');
        svg.setAttribute('height', '14');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'currentColor');
        svg.setAttribute('aria-hidden', 'true');
        const p = document.createElementNS(SVG_NS, 'path');
        p.setAttribute('d', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
        svg.appendChild(p);
        return svg;
    }

    function resolveCourseImage(course) {
        if (course.imageUrl) return course.imageUrl;
        if (course.image_url) return course.image_url;
        const key = String(course.courseKey || '').toLowerCase();
        if (key.indexOf('digital') !== -1) return 'images/Digital-Literacy1.jpg';
        if (key.indexOf('cyber') !== -1) return 'images/kns-cybersecurity.jpg';
        if (key.indexOf('azure') !== -1 || key.indexOf('microsoft') !== -1 || key.indexOf('office') !== -1) {
            return 'images/kns-flexiblelearning.jpg';
        }
        if (key.indexOf('project') !== -1) return 'images/kns-expert.jpg';
        const byCategory = {
            business: 'images/kns-expert.jpg',
            ict: 'images/kns-cybersecurity.jpg',
            microsoft: 'images/kns-flexiblelearning.jpg',
            trainings: 'images/Digital-Literacy1.jpg'
        };
        return byCategory[course.categorySlug] || 'images/kns-certificate.jpg';
    }

    function starsText(average) {
        if (average == null || Number.isNaN(Number(average)) || Number(average) <= 0) {
            return '☆☆☆☆☆';
        }
        const filled = Math.max(0, Math.min(5, Math.round(Number(average))));
        return '★'.repeat(filled) + '☆'.repeat(5 - filled);
    }

    function createCourseCard(course) {
        const slug = course.categorySlug || '';
        const courseKey = course.courseKey || '';
        const enrollName = course.enrollCourseName || courseKey;
        const title = course.displayTitle || courseKey;
        const price = course.priceLabel || 'NLe1';
        const amountMinor =
            course.amountSleMinor != null && Number.isFinite(Number(course.amountSleMinor))
                ? Math.round(Number(course.amountSleMinor))
                : 100;
        const imageSrc = resolveCourseImage(course);
        const metaBits = [course.paceText, course.structuredText].filter(Boolean);
        const metaLine = metaBits.length ? metaBits.join(' · ') : 'Online · KNS College';

        const card = document.createElement('article');
        card.className = 'online-course-card';
        card.setAttribute('data-online-category', slug);
        card.setAttribute('data-course', courseKey);

        const media = document.createElement('div');
        media.className = 'online-course-card__media';
        const img = document.createElement('img');
        img.src = imageSrc;
        img.alt = title;
        img.loading = 'lazy';
        media.appendChild(img);
        card.appendChild(media);

        const body = document.createElement('div');
        body.className = 'online-course-card__body';

        const h3 = document.createElement('h3');
        h3.className = 'online-course-title';
        h3.textContent = title;
        body.appendChild(h3);

        const instructor = document.createElement('p');
        instructor.className = 'online-course-card__instructor';
        instructor.textContent = 'KNS College';
        body.appendChild(instructor);

        const rating = document.createElement('div');
        rating.className = 'online-course-card__rating online-course-card__badge';
        rating.setAttribute('aria-live', 'polite');
        rating.setAttribute('aria-label', 'Course rating: not yet rated');

        const avg = document.createElement('span');
        avg.className = 'online-course-card__badge-average online-course-card__rating-value';
        avg.textContent = '—';
        rating.appendChild(avg);

        const stars = document.createElement('span');
        stars.className = 'online-course-card__stars';
        stars.setAttribute('aria-hidden', 'true');
        stars.setAttribute('data-oc-stars', '1');
        stars.textContent = '☆☆☆☆☆';
        rating.appendChild(stars);

        const countWrap = document.createElement('span');
        countWrap.className = 'online-course-card__badge-count-wrap online-course-card__rating-count';
        countWrap.hidden = true;
        countWrap.appendChild(document.createTextNode('('));
        const countNum = document.createElement('span');
        countNum.className = 'online-course-card__badge-count';
        countNum.textContent = '0';
        countWrap.appendChild(countNum);
        countWrap.appendChild(document.createTextNode(')'));
        rating.appendChild(countWrap);

        const rateBtn = document.createElement('button');
        rateBtn.type = 'button';
        rateBtn.className = 'online-course-card__rate-btn';
        rateBtn.textContent = 'Rate';
        rating.appendChild(rateBtn);
        body.appendChild(rating);

        const meta = document.createElement('p');
        meta.className = 'online-course-card__meta-line';
        meta.textContent = metaLine;
        body.appendChild(meta);

        const priceRow = document.createElement('div');
        priceRow.className = 'online-course-card__price-row';
        const priceEl = document.createElement('p');
        priceEl.className = 'online-course-card__price';
        priceEl.textContent = price;
        priceRow.appendChild(priceEl);
        body.appendChild(priceRow);

        const cta = document.createElement('div');
        cta.className = 'online-course-card__cta online-course-card__cta--cart';

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn btn-secondary online-course-card__add-cart';
        addBtn.setAttribute('data-cart-add', '1');
        addBtn.setAttribute('data-default-label', 'Add to cart');
        addBtn.setAttribute('data-course-key', courseKey);
        addBtn.setAttribute('data-course-name', enrollName);
        addBtn.setAttribute('data-display-title', title);
        addBtn.setAttribute('data-price-label', price);
        addBtn.setAttribute('data-amount-sle-minor', String(amountMinor));
        addBtn.setAttribute('data-image-src', imageSrc);
        addBtn.textContent = 'Add to cart';
        cta.appendChild(addBtn);

        const buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = 'btn btn-primary online-course-card__buy-now';
        buyBtn.setAttribute('data-cart-buy-now', '1');
        buyBtn.setAttribute('data-course-key', courseKey);
        buyBtn.setAttribute('data-course-name', enrollName);
        buyBtn.setAttribute('data-display-title', title);
        buyBtn.setAttribute('data-price-label', price);
        buyBtn.setAttribute('data-amount-sle-minor', String(amountMinor));
        buyBtn.setAttribute('data-image-src', imageSrc);
        buyBtn.textContent = 'Buy now';
        cta.appendChild(buyBtn);

        body.appendChild(cta);

        card.appendChild(body);
        return card;
    }

    function defaultCategories() {
        return [
            {
                slug: 'business',
                sectionTitle: 'Business & management',
                sectionLead: 'Project management, entrepreneurship, accounting, and business technology.',
                sortOrder: 10
            },
            {
                slug: 'ict',
                sectionTitle: 'ICT, software & data',
                sectionLead: 'Digital literacy, cybersecurity, data, hardware, design, and AI essentials.',
                sortOrder: 20
            },
            {
                slug: 'microsoft',
                sectionTitle: 'Microsoft & Azure',
                sectionLead: 'Microsoft Office Specialist and Azure AI learning paths.',
                sortOrder: 30
            }
        ];
    }

    function render(categories, courses) {
        if (!root) return;
        root.textContent = '';
        setError('');

        const byCat = {};
        courses.forEach((c) => {
            const k = c.categorySlug || 'other';
            if (!byCat[k]) byCat[k] = [];
            byCat[k].push(c);
        });

        const metaBySlug = {};
        (categories?.length ? categories : defaultCategories()).forEach((c) => {
            metaBySlug[c.slug] = c;
        });

        const rendered = {};

        function appendSection(slug, catRow) {
            if (rendered[slug]) return;
            const list = byCat[slug];
            if (!list?.length) return;
            rendered[slug] = true;

            const cat = catRow || metaBySlug[slug] || { slug, sectionTitle: slug, sectionLead: '' };

            const section = document.createElement('section');
            section.className = 'online-course-category-block';
            section.setAttribute('data-online-category-section', slug);
            section.setAttribute('aria-labelledby', 'oc-cat-' + slug);

            const head = document.createElement('div');
            head.className = 'online-course-category-block__head';
            const h2 = document.createElement('h2');
            h2.id = 'oc-cat-' + slug;
            h2.className = 'online-course-category-block__title';
            h2.textContent = cat.sectionTitle || slug;
            const lead = document.createElement('p');
            lead.className = 'online-course-category-block__lead';
            lead.textContent = cat.sectionLead || '';
            head.appendChild(h2);
            head.appendChild(lead);
            section.appendChild(head);

            const grid = document.createElement('div');
            grid.className = 'online-courses-grid';
            list.forEach((course) => grid.appendChild(createCourseCard(course)));
            section.appendChild(grid);
            root.appendChild(section);
        }

        if (categories?.length) {
            categories.forEach((cat) => appendSection(cat.slug, cat));
        }
        Object.keys(byCat).forEach((slug) => appendSection(slug, metaBySlug[slug]));

        document.dispatchEvent(
            new CustomEvent('kns-online-courses-loaded', { detail: { count: courses.length } })
        );    }

    function run() {
        if (!root) return;
        setError('');
        const loaderShownAt = Date.now();
        const minSpinnerMs = 450;

        root.innerHTML =
            '<div class="catalog-loader" id="onlineCoursesCatalogLoader" role="status" aria-live="polite" aria-busy="true" aria-label="Loading courses">' +
            '<div class="uib-loader" aria-hidden="true"></div>' +
            '</div>';

        function finishWith(callback) {
            const wait = Math.max(0, minSpinnerMs - (Date.now() - loaderShownAt));
            window.setTimeout(function () {
                root.textContent = '';
                callback();
            }, wait);
        }

        fetch(apiUrl, { method: 'GET', credentials: 'omit', mode: 'cors' })
            .then(parseJsonResponse)
            .then((result) => {
                if (!result.ok || !result.data?.success) {
                    const msg =
                        result.data?.error ||
                        'Could not load courses. Make sure the API is running and run npm run db:setup.';
                    finishWith(function () {
                        setError(msg);
                        document.dispatchEvent(
                            new CustomEvent('kns-online-courses-loaded', { detail: { count: 0, error: true } })
                        );
                    });
                    return;
                }

                const cats = result.data.categories || [];
                const courses = result.data.courses || [];
                if (!courses.length) {
                    finishWith(function () {
                        setError(
                            result.data.message ||
                                'No courses in the catalog yet. Run npm run db:seed on the server.'
                        );
                        document.dispatchEvent(
                            new CustomEvent('kns-online-courses-loaded', { detail: { count: 0 } })
                        );
                    });
                    return;
                }

                finishWith(function () {
                    render(cats.length ? cats : defaultCategories(), courses);
                });
            })
            .catch(() => {
                finishWith(function () {
                    setError('Could not reach the server. Check your connection and try again.');
                    document.dispatchEvent(
                        new CustomEvent('kns-online-courses-loaded', { detail: { count: 0, error: true } })
                    );
                });
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
