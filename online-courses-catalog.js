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

    function createMetaItem(icon, labelText) {
        const span = document.createElement('span');
        span.className = 'online-course-card__meta-item';
        span.appendChild(icon);
        const text = document.createElement('span');
        text.textContent = labelText;
        span.appendChild(text);
        return span;
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

        const card = document.createElement('div');
        card.className = 'online-course-card';
        card.setAttribute('data-online-category', slug);
        card.setAttribute('data-course', courseKey);

        const hero = document.createElement('div');
        hero.className = 'online-course-card__hero';
        const tag = document.createElement('div');
        tag.className = 'online-course-card__price-tag';
        tag.setAttribute('aria-label', 'Course fees');
        const priceSpan = document.createElement('span');
        priceSpan.className = 'online-course-card__price-tag__value';
        priceSpan.textContent = price;
        tag.appendChild(priceSpan);
        hero.appendChild(tag);
        card.appendChild(hero);

        const badge = document.createElement('div');
        badge.className = 'online-course-card__badge';
        badge.setAttribute('aria-live', 'polite');
        badge.setAttribute('aria-label', 'Course rating');
        badge.appendChild(svgIconStarSmall());
        const avg = document.createElement('span');
        avg.className = 'online-course-card__badge-average';
        avg.textContent = '—';
        badge.appendChild(avg);
        const countWrap = document.createElement('span');
        countWrap.className = 'online-course-card__badge-count-wrap';
        countWrap.hidden = true;
        countWrap.appendChild(document.createTextNode('('));
        const countNum = document.createElement('span');
        countNum.className = 'online-course-card__badge-count';
        countNum.textContent = '0';
        countWrap.appendChild(countNum);
        countWrap.appendChild(document.createTextNode(')'));
        badge.appendChild(countWrap);
        const rateBtn = document.createElement('button');
        rateBtn.type = 'button';
        rateBtn.className = 'online-course-card__rate-btn';
        rateBtn.textContent = 'Rate';
        badge.appendChild(rateBtn);
        card.appendChild(badge);

        const body = document.createElement('div');
        body.className = 'online-course-card__body';
        const h3 = document.createElement('h3');
        h3.className = 'online-course-title';
        h3.textContent = title;
        body.appendChild(h3);
        const meta = document.createElement('div');
        meta.className = 'online-course-card__meta';
        meta.appendChild(createMetaItem(svgIconBook(), course.structuredText || 'Structured learning'));
        meta.appendChild(createMetaItem(svgIconClock(), course.paceText || 'Your pace'));
        body.appendChild(meta);
        const enroll = document.createElement('a');
        enroll.className = 'btn btn-primary online-course-card__enroll';
        enroll.setAttribute('data-course-name', enrollName);
        enroll.setAttribute('data-price-label', price);
        enroll.setAttribute('data-amount-sle-minor', String(amountMinor));
        enroll.href = '#';
        enroll.textContent = 'Enroll Now';
        body.appendChild(enroll);
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
        root.textContent = '';
        const loading = document.createElement('p');
        loading.className = 'online-courses-catalog-loading';
        loading.textContent = 'Loading courses…';
        root.appendChild(loading);

        fetch(apiUrl, { method: 'GET', credentials: 'omit', mode: 'cors' })
            .then(parseJsonResponse)
            .then((result) => {
                root.textContent = '';
                if (!result.ok || !result.data?.success) {
                    const msg =
                        result.data?.error ||
                        'Could not load courses. Make sure the API is running and run npm run db:setup.';
                    setError(msg);
                    document.dispatchEvent(
                        new CustomEvent('kns-online-courses-loaded', { detail: { count: 0, error: true } })
                    );
                    return;
                }

                const cats = result.data.categories || [];
                const courses = result.data.courses || [];
                if (!courses.length) {
                    setError(
                        result.data.message ||
                            'No courses in the catalog yet. Run npm run db:seed on the server.'
                    );
                    document.dispatchEvent(
                        new CustomEvent('kns-online-courses-loaded', { detail: { count: 0 } })
                    );
                    return;
                }

                render(cats.length ? cats : defaultCategories(), courses);
            })
            .catch(() => {
                root.textContent = '';
                setError('Could not reach the server. Check your connection and try again.');
                document.dispatchEvent(
                    new CustomEvent('kns-online-courses-loaded', { detail: { count: 0, error: true } })
                );
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }
})();
