مجابيد V376 — تعليمات مسؤول الآيفون — TestFlight فقط

استخدم محتويات مجلد ios كاملاً كجذر مشروع بناء الآيفون، بما فيها config وscripts وwww وios وpackage-lock.json وcodemagic.yaml.
لا تنسخ ملفات web فوق ios/www؛ إعدادات الآيفون الحالية خاصة بالتجربة.
Firebase: majabeed-sandbox
Worker: majabeed-sandbox.samisalimhdmaol.workers.dev
Bundle ID: com.mjabid.play

في Codemagic: شغل workflow يدوياً من جذر هذا المجلد.
يحافظ على تكامل التوقيع الموجود mjabid app، ويرسل إلى TestFlight فقط.
رقم البناء الآلي: 48 + BUILD_NUMBER. تأكد أنه أكبر من آخر بناء مرفوع في App Store Connect؛ عدّل قاعدة 48 عند الحاجة.
لا تغيّر الحساب أو معرف الحزمة. لا تقدم البناء لمراجعة App Store.

للبناء على Mac يدوياً، Node 22 ومن جذر المشروع:
node scripts/select-environment.cjs sandbox
npm ci
npm run test:purchases
node scripts/verify-purchases-build.cjs
npx cap sync ios
node scripts/verify-purchases-build.cjs --copied
npx cap open ios
ثم اختر فريق التوقيع الحالي وارفع Build Number فوق آخر رقم، واعمل Archive ثم ارفع إلى App Store Connect/TestFlight.

لم يتم إنشاء IPA موقعة في هذه الحزمة. لم يجر اختبار شراء فعلي بعد.
تسجيل دخول التجربة: أنشئ حساب بريد وكلمة مرور جديداً داخل اللعبة، وليس حساب الإنتاج أو دخول Apple.
اختبر الذهب وVIP والاستعادة وعدم تكرار الرصيد، ثم أرسل النتائج.
