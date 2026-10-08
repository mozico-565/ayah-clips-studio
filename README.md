# Ayah Clips Studio

ابنِ تطبيق ويب حقيقي Mobile First باسم Ayah Clips لتحويل تلاوات القرآن الطويلة إلى مقاطع قصيرة. العربية RTL والوضع الداكن وتصميم احترافي هادئ. يدعم رفع فيديو MP4 أو صوت MP3/M4A، معاينة الملف، استخراج المسار الصوتي، عرض timeline، اختيار التقسيم كل 4 آيات أو تقسيم وفق الوقف والمعنى مع إمكانية تحرير حدود المقاطع يدويًا، وقوالب الكعبة والطبيعة والمسجد وخلفية خاصة، وعرض الآية الحالية بتشكيل صحيح ومتزامن مع الصوت، مع اختيار 9:16 و1:1 و16:9، قائمة المقاطع ومعاينتها وتصدير MP4 وZIP. استخدم نص قرآن موثوقًا لا تولد آيات بالذكاء الاصطناعي. صمم هندسة واضحة لمحاذاة الصوت مع الآيات مع إظهار أن التوقيت الآلي يحتاج تدقيقًا ولا تدّعِ نجاح التعرف دون تنفيذ فعلي؛ قدم وضع إدخال السورة والآيات وضبط التوقيت يدويًا كمسار عامل عند غياب نموذج التعرف. استخدم FFmpeg أو ffmpeg.wasm إذا أمكن بالفعل واختبر تصدير فيديو واحد حقيقي؛ لا أزرار وهمية ولا mock للوظائف. لا TikTok API ولا تسجيل دخول؛ المشاركة عبر Android native share sheet إن كانت مدعومة، وإلا تنزيل MP4 ثم مشاركته يدويًا. لا تنشر المشروع للعامة تلقائيًا. اختبر الرفع والمقاطع والواجهة ووضح ما يعمل وما لم يكتمل.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f8b6b284-ef0c-4c5d-92da-0b29fd283cd8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
