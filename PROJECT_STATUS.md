# وضعیت پروژه — اپ سه‌بعدی آناتومی عضلات

> آخرین به‌روزرسانی: ۱۴۰۵/۰۳/۱۰ (2026-05-31)
> این سند همه‌ی کارهای انجام‌شده، وضعیت فعلی، مشکلات حل‌شده و کارهای باقی‌مونده رو ثبت می‌کنه.

---

## ۱. خلاصه‌ی یک‌خطی

یک ویوئر سه‌بعدی از عضلات سطحی بدن انسان، ساخته‌شده با Next.js + React Three Fiber.
مدل سه‌بعدی **واقعی** از اطلس رایگان **Z-Anatomy** استخراج و با Blender به GLB تبدیل شده.
الان روی `http://localhost:3003` اجرا می‌شه و **شبیه بدن واقعی انسانه**.

---

## ۲. مسیری که طی کردیم (تاریخچه)

### مشکل اولیه
مدل قبلی (`muscles.glb` قدیمی از BodyParts3D) ناقص بود — عضله‌های مهم سطحی
(دلتوئید، شکم، ساعد) رو نداشت و نازک/سوراخ‌سوراخ دیده می‌شد، شبیه بدن واقعی نبود.

### اشتباهی که شد و اصلاح شد
در یک مرحله، به‌اشتباه یک مدل **پروسیجرال** (عضله‌ها از شکل‌های کدی مثل کپسول و کره)
ساخته شد. کاربر صریحاً رد کرد: **«مدل واقعی انسان می‌خوام، نه ساختگی»**.
آن مدل پروسیجرال (`muscleLayout.ts`) حذف شد و مسیر درست (مدل واقعی) دنبال شد.

### تصمیم نهایی
استفاده از **Z-Anatomy** — یک اطلس open-source آناتومی انسان (بر پایه‌ی BodyParts3D)،
که فایل Blender داره، عضله‌ها جدا و نام‌گذاری‌شده‌ان، و رایگانه.

---

## ۳. مشکل بزرگی که حل شد: بسته‌شدن VSCode

### علت (با مدرک)
هنگام باز کردن فایل ۳۰۷ مگابایتی Blender، فشار حافظه به **۸۳.۶۶٪** می‌رسید و
سرویس `systemd-oomd` اوبونتو **کل VSCode (و ۳۱۰ پروسس زیرمجموعه‌اش) رو می‌کشت**.
این از لاگ سیستم تأیید شد:
```
Killed .../snap.code... due to memory pressure being 83.66% > 50.00%
systemd-oomd killed 310 process(es) — Failed with result 'oom-kill'
```

### راه‌حل اعمال‌شده (با sudo)
| تنظیم | قبل | بعد |
|-------|-----|-----|
| آستانه‌ی فشار oomd | ۵۰٪ | **۸۰٪** |
| مدت قبل از کشتن | ۲۰ ثانیه | **۶۰ ثانیه** |
| معافیت user slice | — | **۸۵٪** |
| کل Swap | ۸ گیگ | **۱۶ گیگ** (افزودن `/swapfile2`) |

- نسخه‌ی پشتیبان تنظیمات اصلی: `/etc/systemd/oomd.conf.bak`
- swap جدید در `/etc/fstab` ثبت شده (بعد از ری‌استارت می‌مونه)
- یک «نگهبان حافظه» (`/tmp/memguard.sh`) هم نوشته شد که اگه RAM بحرانی بشه،
  **فقط Blender** رو می‌کشه نه VSCode رو.

---

## ۴. پایپ‌لاین تبدیل مدل (Z-Anatomy → GLB)

این کاملاً **خودکار و قابل‌تکرار** است:

1. **دانلود**: `Z-Anatomy.zip` (~۸۷ مگ) از
   `https://raw.githubusercontent.com/Z-Anatomy/Models-of-human-anatomy/master/Z-Anatomy.zip`
2. **استخراج** → `Z-Anatomy/Startup.blend` (~۳۰۷ مگ، ۴۵۶۹ آبجکت مش)
3. **تبدیل** با Blender headless (اسکریپت `/tmp/zconv2.py`):
   - تطبیق ۲۲ عضله‌ی سطحی با کلیدواژه‌های لاتین/انگلیسی
   - حذف ۴۳۲۱ مش غیرهدف
   - ادغام چپ+راست هر عضله → یک آبجکت با نام تمیز `snake_case`
   - کاهش پلیگان (decimate ratio = 0.3)
   - خروجی GLB

### دو تله‌ای که حل شد
- **numpy غایب**: Blender این توزیع از Python 3.13 سیستم استفاده می‌کنه و
  اکسپورتر glTF به numpy نیاز داره. نصب شد با
  `python3.13 -m pip install --user --break-system-packages numpy`
  و اسکریپت باید مسیر را صریح اضافه کند:
  `sys.path.insert(0, "/home/pedram/.local/lib/python3.13/site-packages")`
- **خطای multi-user data**: decimate روی مش‌های اشتراکی شکست می‌خورد؛
  با کپی‌کردن `o.data` به single-user حل شد.

---

## ۵. وضعیت فعلی فایل‌ها

### مدل سه‌بعدی
- مسیر: `public/models/muscles.glb`
- حجم: **~۸ مگابایت** (8,032,048 بایت)
- محتوا: **۲۳۸ نود، ۱۳۲ مش** ← این بیش از حد است (در ادامه توضیح)

### کد
| فایل | نقش |
|------|-----|
| `src/data/muscles.ts` | داده‌ی ۲۲ عضله: `id, nameEn, nameFa, region, description` |
| `src/components/MuscleModel.tsx` | بارگذاری GLB، تطبیق نام مش با id، رنگ‌آمیزی، کلیک/hover |
| `src/components/Viewer.tsx` | صحنه‌ی R3F: دوربین، نور، OrbitControls، دکمه‌ی Reset |
| `src/components/Sidebar.tsx` | جستجو، لیست عضلات، پنل جزئیات |
| `src/store/useViewerStore.ts` | state با Zustand (انتخاب/hover/جستجو/reset) |

### قرارداد کلیدی
نام هر نود در GLB == مقدار `id` در `muscles.ts`.
`MuscleModel.tsx` نام مش را (lowercase، با حذف پسوند `.001`) با id ها تطبیق می‌دهد.
**هیچ فیلد `meshName` جداگانه‌ای وجود ندارد.**

---

## ۶. ۲۲ عضله‌ی موجود

گردن: sternocleidomastoid
پشت/شانه: trapezius, deltoid, latissimus_dorsi
سینه: pectoralis_major, serratus_anterior
شکم: rectus_abdominis, external_oblique
بازو: biceps_brachii, triceps_brachii
ساعد: brachioradialis, extensor_digitorum
باسن: gluteus_maximus
ران: rectus_femoris, vastus_lateralis, vastus_medialis, sartorius,
      adductor_longus, biceps_femoris
ساق: gastrocnemius, soleus, tibialis_anterior

> توجه: `tibialis_anterior` در داده هست و در GLB هم موجود است.

---

## ۷. مشکل باقی‌مونده (مهم) ⚠️

موقع تبدیل، گام `make_single_user` باعث شد **زیرقطعات اصلی مدل تکراری بمونن**:
علاوه بر ۲۲ عضله‌ی تمیز نام‌گذاری‌شده، ~۲۱۶ زیرقطعه‌ی اصلی هم در GLB موندن
(مثل `Deltoid muscle.el`, `Long head of biceps brachii.l` و ...).

### پیامدها
- ✅ **ظاهر مدل عالیه** (همین که در اسکرین‌شات دیدی)
- ⚠️ حجم فایل ~۲ برابر شده (~۸ مگ به‌جای ~۴ مگ)
- ⚠️ **کلیک روی عضله ممکنه دقیق نباشه**: قطعات تکراری روی هم افتادن و
  ممکنه جلوی کلیک روی نسخه‌ی نام‌گذاری‌شده رو بگیرن

### راه‌حل
اصلاح اسکریپت تبدیل تا فقط ۲۲ آبجکت نهایی نام‌گذاری‌شده را نگه دارد و
زیرقطعات اصلی را حذف کند، سپس ~۱.۵ دقیقه تبدیل مجدد. (هنوز انجام نشده.)

---

## ۸. کارهای باقی‌مونده

- [ ] **اولویت ۱**: رفع مشکل قطعات تکراری در GLB (بخش ۷) → کلیک درست + فایل سبک‌تر
- [ ] تست کلیک/hover/جستجو روی هر ۲۲ عضله بعد از رفع مشکل بالا
- [ ] بررسی جهت‌گیری و فریم‌بندی پیش‌فرض دوربین (رو به جلو)
- [ ] فعال‌سازی فشرده‌سازی Draco برای کاهش بیشتر حجم (اختیاری)

---

## ۹. لایسنس (مهم برای استفاده‌ی تجاری)

مدل تحت **CC BY-SA 4.0** است. یعنی:
- استفاده‌ی تجاری مجاز ✅
- باید منبع ذکر شود (Attribution) ✅ (در `Viewer.tsx` لینک قرار داده شده)
- **هر اثر مشتق‌شده هم باید با همین لایسنس SA منتشر شود** ⚠️

> متن ذکر منبع:
> Anatomy model: Z-Anatomy (z-anatomy.com), based on BodyParts3D
> © The Database Center for Life Science, CC BY-SA 4.0.

---

## ۱۰. چطور اجرا کنیم

```bash
cd /home/pedram/Desktop/projects/muscle-anatomy
npm run dev -- -p 3003
# سپس باز کن: http://localhost:3003
```

برای تبدیل مجدد مدل (در صورت نیاز):
```bash
# numpy باید نصب باشه (یک‌بار):
python3.13 -m pip install --user --break-system-packages numpy
# تبدیل:
OUT_GLB="$PWD/public/models/muscles.glb" \
  blender --background /tmp/zanat/Z-Anatomy/Startup.blend --python /tmp/zconv2.py
```

---

## ۱۱. فایل‌های کمکی (خارج از پروژه، در /tmp)

| فایل | کاربرد |
|------|--------|
| `/tmp/zconv2.py` | اسکریپت تبدیل Z-Anatomy → GLB |
| `/tmp/zanat/Z-Anatomy/Startup.blend` | فایل اصلی Blender (~۳۰۷ مگ) |
| `/tmp/zanat_manifest_all.json` | لیست همه‌ی ۴۵۶۹ مش اصلی |
| `/tmp/fix_memory.sh` | اسکریپت رفع مشکل حافظه/OOM |
| `/tmp/memguard.sh` | نگهبان حافظه هنگام اجرای Blender |
| `MODEL_SETUP.md` | راهنمای دستی تبدیل در Blender |
