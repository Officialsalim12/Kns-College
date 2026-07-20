(function bootstrapChatbot() {
    function startChatbot() {
    if (window.__knsChatbotInitialized) return;
    window.__knsChatbotInitialized = true;

    const courseDatabase = {
        diplomas: [
            { name: 'Diploma in Cybersecurity', keywords: ['cybersecurity', 'cyber security', 'security', 'isc2', 'cc'], type: 'diploma', duration: '2 Years', mode: 'Online / Hybrid' },
            { name: 'Diploma in Telecommunications', keywords: ['telecommunications', 'telecom', 'telecommunication'], type: 'diploma', duration: '2 Years', mode: 'Online / Hybrid' },
            { name: 'Diploma in Computing & Networking', keywords: ['computing', 'networking', 'ccst', 'cisco networking'], type: 'diploma', duration: '2 Years', mode: 'Online / Hybrid' },
            { name: 'Diploma in IT with Business Management', keywords: ['it business', 'it management', 'business management', 'it and business'], type: 'diploma', duration: '2 Years', mode: 'Online / Hybrid' },
            { name: 'Diploma in Project Management', keywords: ['project management', 'pmi', 'project manager'], type: 'diploma', duration: '2 Years', mode: 'Online / Hybrid' },
            { name: 'Diploma in Enterprise and Small Business', keywords: ['enterprise', 'small business', 'entrepreneurship', 'esb', 'business'], type: 'diploma', duration: '2 Years', mode: 'Online / Hybrid' },
            { name: 'Diploma in Applied Computerised Accounting & Intuit QuickBooks Technology', keywords: ['accounting', 'quickbooks', 'intuit', 'bookkeeping', 'accountant'], type: 'diploma', duration: '2 Years', mode: 'Online / Hybrid' }
        ],
        certificates: [
            { name: 'Digital Marketing with Meta Certified', keywords: ['digital marketing', 'meta', 'marketing', 'social media'], type: 'certificate', duration: '4 Weeks', mode: 'Instructor-Led' },
            { name: 'Data Analyst', keywords: ['data analyst', 'data analysis', 'analytics', 'data science'], type: 'certificate', duration: '12 Weeks', mode: 'Online / Offline' },
            { name: 'Front End Web Development', keywords: ['front end', 'frontend', 'web development', 'html', 'css', 'javascript'], type: 'certificate', duration: '8 Weeks', mode: 'Hybrid' },
            { name: 'Back End Web Development', keywords: ['back end', 'backend', 'server', 'mysql', 'postgresql', 'api'], type: 'certificate', duration: '10 Weeks', mode: 'Hybrid' },
            { name: 'Full Stack Development', keywords: ['full stack', 'fullstack', 'web development', 'full stack developer'], type: 'certificate', duration: '14 Weeks', mode: 'Hybrid' },
            { name: 'AI Prompt Engineering For Professionals', keywords: ['ai prompt', 'prompt engineering', 'chatgpt', 'gpt', 'ai'], type: 'certificate', duration: '3 Weeks', mode: 'Hybrid' },
            { name: 'AI for Web Design', keywords: ['ai web design', 'ai design', 'web design ai'], type: 'certificate', duration: '8 Weeks', mode: 'Hybrid' },
            { name: 'Microsoft Office Specialist', keywords: ['microsoft office', 'mos', 'office specialist', 'word', 'excel', 'powerpoint'], type: 'certificate', duration: '5 Weeks', mode: 'Hybrid' },
            { name: 'Cisco Certified Support Technician (IT Support)', keywords: ['cisco it support', 'ccst it', 'it support', 'cisco support'], type: 'certificate', duration: '16 Weeks', mode: 'Online / Tutor-Led' },
            { name: 'Cisco Certified Support Technician (Cybersecurity)', keywords: ['cisco cybersecurity', 'ccst cybersecurity', 'cisco security'], type: 'certificate', duration: '16 Weeks', mode: 'Online / Tutor-Led' },
            { name: 'Cisco Certified Support Technician (Networking)', keywords: ['cisco networking', 'ccst networking', 'cisco network'], type: 'certificate', duration: '16 Weeks', mode: 'Online / Tutor-Led' },
            { name: 'AutoDesk Certified User - Revit Architecture', keywords: ['revit', 'autodesk revit', 'bim', 'architecture'], type: 'certificate', duration: '16 Weeks', mode: 'Instructor-Led' },
            { name: 'AutoDesk Certified User - AutoCAD', keywords: ['autocad', 'autodesk autocad', 'cad', 'drafting'], type: 'certificate', duration: '16 Weeks', mode: 'Online / Instructor-Led' },
            { name: 'Microsoft Certified: AI-900 Azure AI Fundamentals', keywords: ['ai900', 'azure ai', 'ai fundamentals', 'microsoft ai'], type: 'certificate', duration: '4 Weeks', mode: 'Instructor-Led' },
            { name: 'Microsoft Certified: AZ-900 Azure Fundamentals', keywords: ['az900', 'azure fundamentals', 'azure', 'cloud'], type: 'certificate', duration: '4 Weeks', mode: 'Instructor-Led' },
            { name: 'Microsoft Certified: DP-900 Azure Data Fundamentals', keywords: ['dp900', 'azure data', 'data fundamentals'], type: 'certificate', duration: '4 Weeks', mode: 'Instructor-Led' },
            { name: 'Microsoft Certified: MS-900 Microsoft 365 Fundamentals', keywords: ['ms900', 'microsoft 365', 'office 365', 'm365'], type: 'certificate', duration: '4 Weeks', mode: 'Instructor-Led' },
            { name: 'Microsoft Certified: PL-900 Power Platform Fundamentals', keywords: ['pl900', 'power platform', 'power apps', 'power automate'], type: 'certificate', duration: '4 Weeks', mode: 'Instructor-Led' },
            { name: 'Microsoft Certified: SC-900 Security, Compliance, and Identity Fundamentals', keywords: ['sc900', 'security fundamentals', 'compliance', 'identity'], type: 'certificate', duration: '4 Weeks', mode: 'Instructor-Led' }
        ]
    };

    // match typed text to a programme
    function findCourse(courseQuery) {
        const lowerQuery = courseQuery.toLowerCase().trim();
        const allCourses = [...courseDatabase.diplomas, ...courseDatabase.certificates];
        
        // full name first
        for (const course of allCourses) {
            if (course.name.toLowerCase() === lowerQuery) {
                return course;
            }
        }
        
        // then partial title
        for (const course of allCourses) {
            if (course.name.toLowerCase().includes(lowerQuery) || lowerQuery.includes(course.name.toLowerCase())) {
                return course;
            }
        }
        
        // last resort: keyword score
        let bestMatch = null;
        let maxScore = 0;
        
        for (const course of allCourses) {
            let score = 0;
            for (const keyword of course.keywords) {
                if (lowerQuery.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(lowerQuery)) {
                    score += keyword.length;
                }
            }
            if (score > maxScore) {
                maxScore = score;
                bestMatch = course;
            }
        }
        
        return bestMatch;
    }

    // canned Q&A
    const faqDatabase = [
        {
            keywords: ['admission', 'admissions', 'apply', 'application', 'enroll', 'enrollment', 'how to apply', 'application process', 'register', 'registration', 'sign up', 'join', 'become student'],
            question: 'How do I apply for admission?',
            answer: 'You can apply for admission by visiting our Admissions page or contacting us directly. The application process is simple: 1) Choose your programme, 2) Apply online at webportal.kns.edu.sl/register, 3) Submit required documents, 4) Pay enrollment fee. We offer rolling enrollment with start dates in January, May, or September. Contact us at admission@kns.edu.sl or +232 79 422 442 for assistance.'
        },
        {
            keywords: ['requirement', 'requirements', 'eligibility', 'qualification', 'qualify', 'need', 'prerequisite', 'prerequisites', 'what do i need'],
            question: 'What are the admission requirements?',
            answer: 'Admission requirements vary by programme. Generally, you need a high school certificate or equivalent. Some programmes may have specific prerequisites. For detailed requirements for your chosen programme, please visit our Admissions page or contact our admissions office at admission@kns.edu.sl or +232 79 422 442.'
        },
        {
            keywords: ['deadline', 'deadlines', 'when', 'start date', 'start dates', 'intake', 'semester', 'when can i start', 'when does', 'enrollment period'],
            question: 'When can I start my studies?',
            answer: 'We offer flexible start dates with rolling enrollment. You can begin your studies in January, May, or September. There\'s no strict deadline  you can apply anytime and start in the next available intake period. Contact our admissions office for the next available start date.'
        },
        {
            keywords: ['enrollment fee', 'application fee', 'registration fee', 'deposit', 'how much to apply'],
            question: 'Is there an enrollment fee?',
            answer: 'Yes, there is an enrollment fee of Le1,000. This fee is required to secure your place in the programme. For detailed information about all fees, please contact our admissions office at admission@kns.edu.sl or +232 79 422 442.'
        },
        
        {
            keywords: ['programme', 'programmes', 'programme', 'programmes', 'course', 'courses', 'what programmes', 'what courses', 'offer', 'available', 'study', 'studies'],
            question: 'What programmes do you offer?',
            answer: 'We offer a comprehensive range of programmes including Diploma programmes (2 years), Certificate programmes (4 16 weeks), and Train & Certify Courses. Our programmes cover: Technology (Cybersecurity, Networking, Telecommunications), Business (Project Management, Enterprise & Small Business, Accounting), and more. Visit our programmes page to see all available options.'
        },
        {
            keywords: ['diploma', 'diplomas', 'diploma programme', 'diploma course', 'degree', 'degrees'],
            question: 'What diploma programmes are available?',
            answer: 'We offer Diploma programmes in: Cybersecurity, Telecommunications, Computing & Networking, IT with Business Management, Project Management, Enterprise & Small Business, and Applied Computerised Accounting. All diploma programmes are 2 years in duration and include globally recognized certification exam vouchers. Visit our programmes page for details.'
        },
        {
            keywords: ['certificate', 'certificates', 'certificate programme', 'certificate course', 'short course', 'short courses'],
            question: 'What certificate programmes are available?',
            answer: 'We offer Certificate programmes in various fields including: Digital Marketing, Data Analyst, Front End Web Development, Back End Web Development, Full Stack Development, Cisco Networking, Cisco IT Support, Cisco Cybersecurity, Microsoft Azure, Microsoft AI, Microsoft Office, Autodesk AutoCAD, Autodesk Revit, and more. Certificate programmes range from 4 16 weeks. Visit our programmes page for complete listings.'
        },
        {
            keywords: ['cybersecurity', 'cyber security', 'security', 'hacking', 'ethical hacking', 'information security'],
            question: 'Do you offer cybersecurity programmes?',
            answer: 'Yes! We offer a Diploma in Cybersecurity (2 years) and Certificate in Cisco Cybersecurity. The diploma programme prepares you for the (ISC)² Certified in Cybersecurity (CC) certification with exam voucher included. Learn to protect digital systems and become a cybersecurity professional.'
        },
        {
            keywords: ['software development', 'software engineering', 'programming', 'coding', 'developer', 'web development', 'app development'],
            question: 'Do you offer software development programmes?',
            answer: 'Yes! We offer Certificate Programmes in Front End Web Development, Back End Web Development, and Full Stack Development. Learn modern programming languages, frameworks, and development practices to become a skilled software developer.'
        },
        {
            keywords: ['networking', 'network', 'cisco', 'ccna', 'ccst', 'network administration'],
            question: 'Do you offer networking programmes?',
            answer: 'Yes! We offer Diploma in Computing & Networking (2 years) and Certificate programmes in Cisco Networking and Cisco IT Support. Learn network design, configuration, troubleshooting, and prepare for Cisco CCST Networking certification.'
        },
        {
            keywords: ['business', 'management', 'project management', 'pmi', 'enterprise', 'entrepreneurship'],
            question: 'Do you offer business programmes?',
            answer: 'Yes! We offer Diploma programmes in Project Management, Enterprise & Small Business, and Applied Computerised Accounting. We also offer Certificate programmes in Digital Marketing and Data Analyst. These programmes prepare you for PMI, ESB, and other business certifications.'
        },
        {
            keywords: ['accounting', 'accountant', 'bookkeeping', 'quickbooks', 'intuit', 'financial'],
            question: 'Do you offer accounting programmes?',
            answer: 'Yes! We offer Diploma in Applied Computerised Accounting & Intuit QuickBooks Technology (2 years). This programme prepares you for Intuit Certified Bookkeeping Professional certification and provides handson training in modern accounting software.'
        },
        {
            keywords: ['microsoft', 'azure', 'office', 'microsoft 365', 'ms900', 'az900', 'ai900'],
            question: 'Do you offer Microsoft certification programmes?',
            answer: 'Yes! We offer Certificate programmes for Microsoft certifications including: Azure Fundamentals (AZ900), Azure AI Fundamentals (AI900), Azure Data Fundamentals (DP900), Microsoft 365 Fundamentals (MS900), Power Platform Fundamentals (PL900), Security Fundamentals (SC900), and Microsoft Office Specialist (MOS).'
        },
        {
            keywords: ['autocad', 'autodesk', 'revit', 'cad', 'drafting', 'architecture', 'engineering design'],
            question: 'Do you offer AutoCAD or Autodesk programmes?',
            answer: 'Yes! We offer Certificate programmes in Autodesk Certified User  AutoCAD and Autodesk Certified User  Revit Architecture. Learn 2D/3D CAD design, BIM modeling, and technical drawing skills for engineering and architecture.'
        },
        {
            keywords: ['telecommunications', 'telecom', 'telecommunication', 'mobile network', 'fiber', 'network engineer'],
            question: 'Do you offer telecommunications programmes?',
            answer: 'Yes! We offer a Diploma in Telecommunications (2 years) covering modern telecommunication systems, mobile networks, fiber optics, and network management. This programme includes PMI Project Management Ready certification and prepares you for careers in Sierra Leone\'s telecom sector.'
        },
        {
            keywords: ['digital marketing', 'marketing', 'social media', 'meta', 'facebook', 'instagram', 'advertising'],
            question: 'Do you offer digital marketing programmes?',
            answer: 'Yes! We offer a Certificate programme in Digital Marketing with Meta Certified. Learn social media marketing, content marketing, advertising strategies, and earn Meta certification credentials. Duration is 4 weeks with instructorled training.'
        },
        {
            keywords: ['data analyst', 'data analysis', 'data science', 'analytics', 'excel', 'sql', 'statistics'],
            question: 'Do you offer data analysis programmes?',
            answer: 'Yes! We offer a Certificate programme in Data Analyst (12 weeks). Learn data analysis, visualization, statistical analysis, reporting, and master tools like Excel, SQL, and data visualization platforms. Available online or offline.'
        },
        
        {
            keywords: ['fee', 'fees', 'cost', 'price', 'pricing', 'tuition', 'how much', 'payment', 'pay', 'costs', 'expense', 'expensive', 'affordable'],
            question: 'What are the fees?',
            answer: 'Our fees vary depending on the programme you choose. Diploma programmes (2 years) have different fees than Certificate programmes (4 16 weeks). Each diploma programme includes a voucher for a globally recognized certification exam. For detailed fee information for your specific programme of interest, please contact our admissions office at admission@kns.edu.sl or call +232 79 422 442.'
        },
        {
            keywords: ['payment plan', 'installment', 'installments', 'monthly payment', 'pay monthly', 'financing', 'scholarship', 'scholarships', 'financial aid', 'discount'],
            question: 'Do you offer payment plans or scholarships?',
            answer: 'For information about payment plans, installments, scholarships, or financial assistance, please contact our admissions office directly at admission@kns.edu.sl or +232 79 422 442. We understand that financing education is important and are happy to discuss options with you.'
        },
        
        {
            keywords: ['online', 'distance', 'remote', 'elearning', 'virtual', 'online learning', 'study online'],
            question: 'Do you offer online learning?',
            answer: 'Yes! We offer flexible study options including fully Online or Hybrid (online + inperson) learning. Our mobilefriendly platform allows 24/7 access to course materials, so you can learn at your own pace and fit your studies around your schedule. Many programmes are available online.'
        },
        {
            keywords: ['hybrid', 'blended', 'parttime', 'fulltime', 'flexible', 'schedule', 'when are classes', 'class schedule', 'class time'],
            question: 'What learning modes are available?',
            answer: 'We offer Online, Hybrid (online + inperson), and InstructorLed options. Many programmes offer flexible scheduling to accommodate working professionals. Our mobilefriendly platform provides 24/7 access to course materials. Check specific programme details for available learning modes.'
        },
        {
            keywords: ['duration', 'length', 'how long', 'time', 'period', 'weeks', 'months', 'years', 'semester'],
            question: 'How long are the programmes?',
            answer: 'programme duration varies: Diploma programmes are 2 years, Certificate programmes range from 4 16 weeks depending on the course. For example, Microsoft certification courses are typically 4 weeks, while Data Analyst is 12 weeks, and some technology certificates are 16 weeks. Visit our programmes page for specific durations.'
        },
        {
            keywords: ['schedule', 'timetable', 'class time', 'when', 'hours', 'evening', 'weekend', 'morning', 'afternoon'],
            question: 'What is the class schedule?',
            answer: 'Class schedules vary by programme and learning mode. We offer flexible scheduling including evening and weekend options for working professionals. Online programmes allow you to study at your own pace. Contact us at admission@kns.edu.sl or +232 79 422 442 for specific schedule information for your programme of interest.'
        },
        
        {
            keywords: ['certification', 'certificate', 'certified', 'credential', 'badge', 'certiport', 'cisco', 'microsoft', 'exam', 'voucher'],
            question: 'What certifications are included?',
            answer: 'Every diploma programme includes a voucher for a globally recognized certification exam from partners like Cisco, (ISC)², PMI, and Microsoft. We also issue Credly Digital Badges for every qualification. Certificate programmes prepare you for specific certifications. Visit our programmes page to see which certifications are included with each programme.'
        },
        {
            keywords: ['cisco', 'ccna', 'ccst', 'cisco certification', 'cisco exam'],
            question: 'What Cisco certifications do you offer?',
            answer: 'We offer programmes that prepare you for Cisco Certified Support Technician (CCST) Networking certification. Our Diploma in Computing & Networking includes CCST exam voucher. We also offer Certificate programmes in Cisco Networking, Cisco IT Support, and Cisco Cybersecurity.'
        },
        {
            keywords: ['isc2', 'isc', 'cybersecurity certification', 'cc certification', 'certified in cybersecurity'],
            question: 'What (ISC)² certifications do you offer?',
            answer: 'Our Diploma in Cybersecurity prepares you for the (ISC)² Certified in Cybersecurity (CC) certification. The programme includes the exam voucher, so you can earn this globally recognized cybersecurity credential upon completion.'
        },
        {
            keywords: ['pmi', 'project management', 'pm certification', 'project management ready'],
            question: 'What PMI certifications do you offer?',
            answer: 'We offer programmes that prepare you for PMI Project Management Ready certification. Our Diploma in Project Management and Diploma in Telecommunications include PMI Project Management Ready certification with Credly badges.'
        },
        {
            keywords: ['microsoft certification', 'microsoft exam', 'azure', 'microsoft office', 'mos'],
            question: 'What Microsoft certifications do you offer?',
            answer: 'We offer Certificate programmes for multiple Microsoft certifications: Azure Fundamentals (AZ900), Azure AI Fundamentals (AI900), Azure Data Fundamentals (DP900), Microsoft 365 Fundamentals (MS900), Power Platform Fundamentals (PL900), Security Fundamentals (SC900), and Microsoft Office Specialist (MOS).'
        },
        {
            keywords: ['intuit', 'quickbooks', 'bookkeeping', 'bookkeeper', 'accounting software'],
            question: 'What Intuit certifications do you offer?',
            answer: 'Our Diploma in Applied Computerised Accounting & Intuit QuickBooks Technology prepares you for Intuit Certified Bookkeeping Professional certification. Learn QuickBooks and modern accounting software through handson training.'
        },
        {
            keywords: ['autodesk certification', 'autocad certification', 'revit certification'],
            question: 'What Autodesk certifications do you offer?',
            answer: 'We offer Certificate programmes for Autodesk Certified User  AutoCAD and Autodesk Certified User  Revit Architecture. These certifications validate your skills in CAD design and BIM modeling.'
        },
        {
            keywords: ['testing', 'exam', 'test center', 'pearson vue', 'certiport', 'take exam', 'where to take exam'],
            question: 'Can I take certification exams at KNS?',
            answer: 'Yes! KNS is an authorized Pearson VUE Select and Certiport Testing Center. This means you can train and test for global credentials like Cisco, (ISC)², Microsoft, PMI, Intuit QuickBooks, and Autodesk in a supportive and familiar environment. You don\'t need to travel elsewhere for your certification exams.'
        },
        {
            keywords: ['badge', 'digital badge', 'credly', 'verifiable', 'linkedin', 'share badge'],
            question: 'What are digital badges?',
            answer: 'We partner with Credly to issue a digital badge for every qualification you earn. These verifiable digital credentials allow you to share and showcase your skills with employers and on professional networks like LinkedIn. Digital badges give you a modern, competitive edge in the job market.'
        },
        
        {
            keywords: ['location', 'address', 'where', 'campus', 'office', 'find', 'directions', 'map'],
            question: 'Where is KNS College located?',
            answer: 'KNS College is located at 18 Dundas Street, Freetown, Sierra Leone. We are also an authorized Pearson VUE Select and Certiport Testing Center, so you can train and test in a familiar, supportive environment. Visit our Contact page for directions and more location details.'
        },
        {
            keywords: ['facility', 'facilities', 'lab', 'laboratory', 'computer lab', 'library', 'resources', 'equipment'],
            question: 'What facilities do you have?',
            answer: 'KNS College has modern facilities including computer labs, testing centers for Pearson VUE and Certiport exams, and learning resources. As an authorized testing center, we provide a supportive environment for both training and certification exams. Contact us to learn more about our facilities.'
        },
        
        {
            keywords: ['contact', 'phone', 'email', 'whatsapp', 'reach', 'get in touch', 'call', 'message', 'support'],
            question: 'How can I contact you?',
            answer: 'You can reach us via Phone/WhatsApp at +232 79 422 442, Email at admission@kns.edu.sl (for admissions) or training@kns.edu.sl (for training inquiries), or visit our Contact page. Our office is located at 18 Dundas Street, Freetown, Sierra Leone. We\'re here to help!'
        },
        {
            keywords: ['email', 'email address', 'send email', 'mail'],
            question: 'What is your email address?',
            answer: 'For admissions inquiries: admission@kns.edu.sl. For training inquiries: training@kns.edu.sl. You can also visit our Contact page for more ways to reach us.'
        },
        {
            keywords: ['phone', 'telephone', 'call', 'phone number', 'mobile', 'cell'],
            question: 'What is your phone number?',
            answer: 'You can reach us by phone or WhatsApp at +232 79 422 442. We\'re available to answer your questions and assist with admissions, programme information, and more.'
        },
        {
            keywords: ['website', 'url', 'web address', 'online', 'visit'],
            question: 'What is your website?',
            answer: 'Our website is kns.edu.sl. You can find detailed information about our programmes, admissions process, and contact details there. You can also apply online at webportal.kns.edu.sl/register.'
        },
        {
            keywords: ['help', 'support', 'assistance', 'need help', 'question', 'inquiry', 'information'],
            question: 'How can I get help?',
            answer: 'We\'re here to help! You can contact us via Phone/WhatsApp at +232 79 422 442, Email at admission@kns.edu.sl, or visit our Contact page. Our admissions team is ready to assist with any questions about programmes, admissions, fees, or any other inquiries.'
        },
        
        {
            keywords: ['recognition', 'accredited', 'accreditation', 'ministry', 'mocti', 'champion', 'recognized', 'official', 'legitimate'],
            question: 'Is KNS College recognized?',
            answer: 'Yes! KNS College is recognized by the Ministry of Communication, Technology & Innovation (MoCTI) as the "Digital Skills Champion 2025." We are also an authorized Pearson VUE Select and Certiport Testing Center. Our programmes and certifications are globally recognized and trusted by employers worldwide.'
        },
        {
            keywords: ['accredited', 'accreditation', 'accredited by', 'who accredits'],
            question: 'Is KNS College accredited?',
            answer: 'KNS College is recognized by the Ministry of Communication, Technology & Innovation (MoCTI) as the "Digital Skills Champion 2025." We are authorized testing centers for Pearson VUE and Certiport, and our programmes include globally recognized certifications from partners like Cisco, (ISC)², PMI, and Microsoft.'
        },
        
        {
            keywords: ['job', 'career', 'employment', 'placement', 'opportunities', 'work', 'employment opportunities', 'job placement', 'career services'],
            question: 'What career opportunities are available?',
            answer: 'Our programmes are directly mapped to highdemand job roles in Sierra Leone and across West Africa. We provide careerfocused pathways in technology, telecommunications, and business. Every programme includes globally recognized certifications that employers trust worldwide. Graduates find opportunities as cybersecurity professionals, network administrators, software developers, project managers, and more.'
        },
        {
            keywords: ['job placement', 'placement assistance', 'career support', 'help find job', 'employment support'],
            question: 'Do you help with job placement?',
            answer: 'While we don\'t guarantee job placement, our programmes are designed to prepare you for highdemand careers. We provide globally recognized certifications that employers value, careerfocused training, and industryintegrated learning. Many of our graduates find success in their chosen fields. Contact us to learn more about career support services.'
        },
        
        {
            keywords: ['corporate', 'corporate training', 'business training', 'company training', 'employee training', 'organization training'],
            question: 'Do you offer corporate training?',
            answer: 'Yes! We offer Corporate Training programmes for businesses and organizations. Our corporate training can be customized to meet your organization\'s specific needs. Contact us at training@kns.edu.sl or +232 79 422 442 to discuss your corporate training requirements.'
        },
        
        {
            keywords: ['about', 'who are you', 'what is kns', 'college', 'institution', 'school', 'university'],
            question: 'What is KNS College?',
            answer: 'Knowledge Network Solutions (KNS) College is Sierra Leone\'s premier institution for technology, telecommunications, and business education. We transform passionate learners into globally certified, jobready professionals. Recognized as "Digital Skills Champion 2025" by MoCTI, we offer industryintegrated programmes with globally recognized certifications from partners like Cisco, (ISC)², PMI, and Microsoft.'
        },
        {
            keywords: ['vision', 'mission', 'goal', 'purpose', 'why', 'why choose'],
            question: 'What is your vision and mission?',
            answer: 'Our Vision: To be West Africa\'s most trusted digital transformation partner, shaping a secure, connected, and digitally empowered future. Our Mission: To empower organizations and communities across Africa with innovative, secure, and humancentered digital solutions, strengthening capacity and driving sustainable digital transformation.'
        },
        {
            keywords: ['why choose', 'why kns', 'benefits', 'advantages', 'what makes different', 'unique', 'special'],
            question: 'Why should I choose KNS College?',
            answer: 'KNS College offers: Expertled instruction from certified instructors, Industryintegrated learning, Global certifications included in programmes, Credly Digital Badges, Flexible study options (Online/Hybrid), Official testing center (Pearson VUE & Certiport), Careerfocused pathways, and National recognition as "Digital Skills Champion 2025." We bridge the gap between academic theory and realworld job requirements.'
        },
        {
            keywords: ['instructor', 'teacher', 'faculty', 'staff', 'who teaches', 'qualified', 'experience'],
            question: 'Who are the instructors?',
            answer: 'Our instructors are certified professionals with years of realworld industry experience. They are expertled instructors who bring practical knowledge and current industry practices to the classroom. Our faculty includes certified professionals in their respective fields.'
        },
        {
            keywords: ['student', 'students', 'how many', 'enrollment', 'community'],
            question: 'How many students do you have?',
            answer: 'KNS College serves students across Sierra Leone and beyond. We welcome students from diverse backgrounds who are passionate about technology, telecommunications, and business. Contact our admissions office to learn more about our student community and enrollment.'
        },
        {
            keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'],
            question: 'Greeting',
            answer: 'Hello! <span style="color: #ffffff; font-weight: 600;">Welcome to KNS College</span>. I\'m here to help answer your questions about our programmes, admissions, fees, certifications, and more. What would you like to know?'
        },
        {
            keywords: ['thank', 'thanks', 'thank you', 'appreciate'],
            question: 'Thank you',
            answer: 'You\'re welcome! If you have any more questions, feel free to ask. You can also contact us directly at +232 79 422 442 or admission@kns.edu.sl for personalized assistance. Good luck with your educational journey!'
        },
        {
            keywords: ['bye', 'goodbye', 'see you', 'farewell'],
            question: 'Goodbye',
            answer: 'Thank you for visiting KNS College! If you need any further assistance, don\'t hesitate to contact us at +232 79 422 442 or admission@kns.edu.sl. We wish you all the best in your educational journey!'
        },
        {
            keywords: ['okay', 'ok', 'alright', 'alright', 'sure', 'got it', 'understood', 'fine', 'yes', 'yeah', 'yep', 'yup', 'acknowledge', 'acknowledged'],
            question: 'Acknowledgment',
            answer: 'Great! Is there anything else you\'d like to know about KNS College? I can help with information about programmes, admissions, fees, certifications, or anything else you need.'
        }
    ];

    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotWidget = document.getElementById('chatbotWidget');
    const chatbotMinimize = document.getElementById('chatbotMinimize');
    const chatbotClose = document.getElementById('chatbotClose');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const whatsappBtn = document.getElementById('whatsappSupportBtn');

    const whatsappNumber = '23279422442';
    const whatsappMessage = encodeURIComponent('Hello! I need help with KNS College.');

    // welcome message + quick picks
    function initChatbot() {
        addMessage('bot', 'Hello! I\'m here to help answer your questions about KNS College. What would you like to know?');
        addQuickQuestions();
    }

    // store chat in DB when API is up
    async function saveMessage(sender, message) {
        try {
            const sessionId = typeof getSessionId !== 'undefined' ? getSessionId() : 'session_' + Date.now();
            const apiUrl = (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:3000') + '/api/messages';
            
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    sender: sender,
                    message: message
                })
            });
            
            if (!response.ok) {
                console.error('Failed to save message:', response.statusText);
            }
        } catch (error) {
            // API down — chat still works locally
            console.error('Error saving message to database:', error);
        }
    }

    function addMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.textContent = text;
        messageContent.style.whiteSpace = 'pre-wrap';
        
        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
        saveMessage(sender, text);
    }

    function addQuickQuestions() {
        const quickQuestions = [
            'How do I apply?',
            'What programmes do you offer?',
            'What are the fees?',
            'Do you offer online learning?',
            'What certifications are included?',
            'Where are you located?'
        ];

        const quickQuestionsDiv = document.createElement('div');
        quickQuestionsDiv.className = 'quick-questions';
        
        quickQuestions.forEach(question => {
            const btn = document.createElement('button');
            btn.className = 'quick-question-btn';
            btn.textContent = question;
            btn.addEventListener('click', () => {
                handleUserMessage(question);
                quickQuestionsDiv.remove();
            });
            quickQuestionsDiv.appendChild(btn);
        });
        
        chatMessages.appendChild(quickQuestionsDiv);
    }

    // score user text against FAQ keywords
    function findBestMatch(userMessage) {
        const lowerMessage = userMessage.toLowerCase().trim();
        
        // drop noise words before matching
        const cleanedMessage = lowerMessage
            .replace(/\b(what|where|when|who|why|how|is|are|do|does|can|could|will|would|should|tell|give|show|explain|i|me|my|you|your|we|our|the|a|an|to|for|of|in|on|at|with|about)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        let bestMatch = null;
        let maxScore = 0;
        const exactMatches = [];
        const partialMatches = [];

        faqDatabase.forEach((faq, index) => {
            let score = 0;
            let exactMatchFound = false;
            let keywordMatches = 0;
            
            faq.keywords.forEach(keyword => {
                const lowerKeyword = keyword.toLowerCase();
                
                // full keyword hit
                if (lowerMessage.includes(lowerKeyword) || cleanedMessage.includes(lowerKeyword)) {
                    // whole word match
                    const regex = new RegExp(`\\b${lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    if (regex.test(lowerMessage) || regex.test(cleanedMessage)) {
                        score += 10;
                        exactMatchFound = true;
                        keywordMatches++;
                    } else {
                        score += 5;
                        keywordMatches++;
                    }
                }
                
                // split long keywords
                if (lowerKeyword.length > 3) {
                    const keywordParts = lowerKeyword.split(/\s+/);
                    keywordParts.forEach(part => {
                        if (part.length > 3 && (lowerMessage.includes(part) || cleanedMessage.includes(part))) {
                            score += 2;
                        }
                    });
                }
            });
            
            // bonus when several keywords line up
            if (keywordMatches > 1) {
                score += keywordMatches * 2;
            }
            
            // also check the FAQ question wording
            const lowerQuestion = faq.question.toLowerCase();
            const questionWords = lowerQuestion.split(/\s+/).filter(w => w.length > 3);
            questionWords.forEach(word => {
                if (lowerMessage.includes(word) || cleanedMessage.includes(word)) {
                    score += 3;
                }
            });
            
            if (exactMatchFound) {
                exactMatches.push({ faq, score, index });
            } else if (score > 0) {
                partialMatches.push({ faq, score, index });
            }
            
            if (score > maxScore) {
                maxScore = score;
                bestMatch = faq;
            }
        });

        // exact hits win over fuzzy ones
        if (exactMatches.length > 0) {
            exactMatches.sort((a, b) => b.score - a.score);
            return exactMatches[0].faq;
        }
        
        // need a decent score or we say we don't know
        if (maxScore >= 5) {
            return bestMatch;
        }
        
        // hi / thanks / bye etc.
        const commonQuestions = {
            'hello': 'Greeting',
            'hi': 'Greeting',
            'hey': 'Greeting',
            'thanks': 'Thank you',
            'thank you': 'Thank you',
            'bye': 'Goodbye',
            'goodbye': 'Goodbye',
            'okay': 'Acknowledgment',
            'ok': 'Acknowledgment',
            'alright': 'Acknowledgment',
            'sure': 'Acknowledgment',
            'got it': 'Acknowledgment',
            'understood': 'Acknowledgment',
            'fine': 'Acknowledgment',
            'yes': 'Acknowledgment',
            'yeah': 'Acknowledgment',
            'yep': 'Acknowledgment',
            'yup': 'Acknowledgment'
        };
        
        for (const [pattern, questionType] of Object.entries(commonQuestions)) {
            if (lowerMessage.includes(pattern)) {
                const match = faqDatabase.find(faq => faq.question === questionType);
                if (match) return match;
            }
        }
        
        return null;
    }

    // work out if they're asking about a specific course
    function extractCourseQuery(message) {
        const lowerMessage = message.toLowerCase();
        
        // "do you offer..." style questions
        const availabilityPatterns = [
            /do you (offer|have|provide|teach).*?(course|programme|diploma|certificate)/i,
            /is.*?(available|offered|taught)/i,
            /can i (study|learn|take|enroll).*/i,
            /.*?(course|programme|diploma|certificate).*?(available|offer|have)/i,
            /.*?(available|offer|have).*?(course|programme|diploma|certificate)/i,
            /tell me about.*?(course|programme|diploma|certificate)/i,
            /what.*?(course|programme|diploma|certificate).*?(do you|offer|have)/i
        ];
        
        const isAvailabilityQuery = availabilityPatterns.some(pattern => pattern.test(message));
        
        // any programme keyword in the message?
        const allCourses = [...courseDatabase.diplomas, ...courseDatabase.certificates];
        let foundCourseKeyword = false;
        for (const course of allCourses) {
            for (const keyword of course.keywords) {
                if (lowerMessage.includes(keyword.toLowerCase())) {
                    foundCourseKeyword = true;
                    break;
                }
            }
            if (foundCourseKeyword) break;
        }
        
        if (!isAvailabilityQuery && !foundCourseKeyword) {
            return null;
        }
        
        // match title or keyword list
        for (const course of allCourses) {
            const courseNameLower = course.name.toLowerCase();
            if (lowerMessage.includes(courseNameLower) || 
                (courseNameLower.length > 15 && lowerMessage.includes(courseNameLower.substring(0, 15)))) {
                return course.name;
            }
            for (const keyword of course.keywords) {
                if (lowerMessage.includes(keyword.toLowerCase())) {
                    return course.name;
                }
            }
        }
        
        // peel off question fluff
        let cleaned = message
            .replace(/\b(do|you|offer|have|provide|teach|is|are|can|i|study|learn|take|enroll|available|offered|taught|course|programme|diploma|certificate|in|for|about|the|a|an|tell|me|what|which)\b/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (cleaned.length >= 3) {
            return cleaned;
        }
        
        return null;
    }

    function handleUserMessage(message) {
        if (!message.trim()) return;

        addMessage('user', message);

        // remove suggestion chips once they type
        const quickQuestions = chatMessages.querySelector('.quick-questions');
        if (quickQuestions) {
            quickQuestions.remove();
        }

        // course questions before generic FAQ
        const courseQuery = extractCourseQuery(message);
        if (courseQuery) {
            const course = findCourse(courseQuery);
            if (course) {
                setTimeout(() => {
                    const courseType = course.type === 'diploma' ? 'Diploma programme' : 'Certificate programme';
                    addMessage('bot', `Yes! We offer ${course.name}. This is a ${courseType} with a duration of ${course.duration} and available in ${course.mode} mode. Would you like more details about this programme?`);
                    setTimeout(() => {
                        addMessage('bot', `Visit our programmes page or call +232 79 422 442 for more on ${course.name}.`);
                    }, 1000);
                }, 500);
                return;
            } else {
                // nothing matched that query
                setTimeout(() => {
                    addMessage('bot', `I couldn't find a course matching "${courseQuery}" in our current offerings.`);
                    setTimeout(() => {
                        addMessage('bot', 'We offer Diploma programmes in: Cybersecurity, Telecommunications, Computing & Networking, IT with Business Management, Project Management, Enterprise & Small Business, and Applied Computerised Accounting.');
                    }, 800);
                    setTimeout(() => {
                        addMessage('bot', 'We also offer Certificate programmes in: Digital Marketing, Data Analyst, Front End/Back End/Full Stack Web Development, AI courses, Microsoft certifications, Cisco certifications, and Autodesk courses.');
                    }, 1600);
                    setTimeout(() => {
                        addMessage('bot', 'For a complete list, please visit our programmes page or contact us at +232 79 422 442.');
                    }, 2400);
                }, 500);
                return;
            }
        }

        const match = findBestMatch(message);

        // small pause so it feels like typing
        setTimeout(() => {
            if (match) {
                addMessage('bot', match.answer);
                
                // nudge them toward related pages
                if (match.keywords.some(k => ['admission', 'apply', 'enroll'].includes(k.toLowerCase()))) {
                    setTimeout(() => {
                        addMessage('bot', 'You can also visit Admissions or call +232 79 422 442 if you want help with your application.');
                    }, 1000);
                } else if (match.keywords.some(k => ['programme', 'course', 'diploma', 'certificate'].includes(k.toLowerCase()))) {
                    setTimeout(() => {
                        addMessage('bot', 'Our programmes page has duration, certifications, and learning modes for everything we offer.');
                    }, 1000);
                } else if (match.keywords.some(k => ['fee', 'cost', 'price'].includes(k.toLowerCase()))) {
                    setTimeout(() => {
                        addMessage('bot', 'For fees on a specific programme, email admission@kns.edu.sl or call +232 79 422 442.');
                    }, 1000);
                }
            } else {
                // no FAQ hit — show what we can answer
                addMessage('bot', 'I\'m sorry, I couldn\'t find a specific answer to that question. Here are some topics I can help with:');
                
                setTimeout(() => {
                    addMessage('bot', '• Admissions and how to apply\n• Available programmes and courses\n• Fees and payment options\n• Online learning options\n• Certifications included\n• Contact information and location');
                }, 800);
                
                setTimeout(() => {
                    addMessage('bot', 'Call or WhatsApp +232 79 422 442, or email admission@kns.edu.sl. You can also try rephrasing your question.');
                }, 1600);
                
                // put quick picks back
                setTimeout(() => {
                    addQuickQuestions();
                }, 2400);
            }
        }, 500);
    }

    function clearChatHistory() {
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
    }

    function startNewConversation() {
        clearChatHistory();
        initChatbot();
    }

    if (chatbotToggle) {
        chatbotToggle.addEventListener('click', function() {
            chatbotWidget.classList.remove('minimized');
            chatbotWidget.classList.add('active');
            chatbotToggle.style.display = 'none';
            if (whatsappBtn) {
                whatsappBtn.style.display = 'none';
            }
            
            // first time they open it
            if (chatMessages && chatMessages.children.length === 0) {
                initChatbot();
            }
        });
    }

    // minimise but keep messages in the panel
    if (chatbotMinimize) {
        chatbotMinimize.addEventListener('click', function(e) {
            e.stopPropagation();
            chatbotWidget.classList.add('minimized');
            chatbotWidget.classList.remove('active');
            if (chatbotToggle) {
                chatbotToggle.style.display = 'flex';
            }
            if (whatsappBtn) {
                whatsappBtn.style.display = 'flex';
            }
        });
    }

    if (chatbotWidget) {
        const chatbotHeader = chatbotWidget.querySelector('.chatbot-header');
        if (chatbotHeader) {
            chatbotHeader.addEventListener('click', function(e) {
                // header bar only — not the X/min buttons
                if (e.target === chatbotHeader || e.target.closest('.chatbot-header-info')) {
                    if (chatbotWidget.classList.contains('minimized')) {
                        chatbotWidget.classList.remove('minimized');
                        chatbotWidget.classList.add('active');
                        if (chatbotToggle) {
                            chatbotToggle.style.display = 'none';
                        }
                        if (whatsappBtn) {
                            whatsappBtn.style.display = 'none';
                        }
                    }
                }
            });
        }
    }

    // close clears the thread
    if (chatbotClose) {
        chatbotClose.addEventListener('click', function(e) {
            e.stopPropagation();
            chatbotWidget.classList.remove('active');
            chatbotWidget.classList.remove('minimized');
            chatbotToggle.style.display = 'flex';
            if (whatsappBtn) {
                whatsappBtn.style.display = 'flex';
            }
            startNewConversation();
        });
    }

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', function() {
            const message = chatInput.value.trim();
            if (message) {
                handleUserMessage(message);
                chatInput.value = '';
            }
        });
    }

    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                const message = chatInput.value.trim();
                if (message) {
                    handleUserMessage(message);
                    chatInput.value = '';
                }
            }
        });
    }

    if (whatsappBtn) {
        whatsappBtn.addEventListener('click', function() {
            const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;
            window.open(whatsappUrl, '_blank');
        });
    }

    // build chat the first time the widget opens
    if (chatbotWidget) {
        const observer = new MutationObserver(function(mutations) {
            if (chatbotWidget.classList.contains('active') && chatMessages.children.length === 0) {
                initChatbot();
            }
        });
        
        observer.observe(chatbotWidget, {
            attributes: true,
            attributeFilter: ['class']
        });
    }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startChatbot);
    } else {
        startChatbot();
    }
})();


