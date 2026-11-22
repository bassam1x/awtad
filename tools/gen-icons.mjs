import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const REPO = fileURLToPath(new URL('../', import.meta.url)).replace(/\\\\/g, '/');   // جذر المشروع
const ROOT = REPO + 'apps/web/';
const MAP = `AlertCircle:WarningCircle AlertTriangle:Warning ArrowRight:ArrowRight Award:Medal BadgeCheck:SealCheck BadgeDollarSign:Coins Ban:Prohibit Briefcase:Briefcase Building2:Buildings
CalendarDays:CalendarBlank Check:Check CheckCircle2:CheckCircle CheckSquare:CheckSquare ChevronDown:CaretDown ChevronLeft:CaretLeft ChevronsUpDown:CaretUpDown ClipboardCheck:ClipboardText
ClipboardList:ClipboardText Clock:Clock Crop:Crop ExternalLink:ArrowSquareOut FileText:FileText FlaskConical:Flask FolderKanban:Kanban FolderPlus:FolderPlus GraduationCap:GraduationCap
Handshake:Handshake Inbox:Tray KeyRound:Key Languages:Translate Laptop:Laptop DotsThree:DotsThree Layers:Stack LayoutDashboard:SquaresFour Link2:LinkSimple ListChecks:ListChecks Loader2:CircleNotch LogIn:SignIn LogOut:SignOut
Mail:EnvelopeSimple Map:MapTrifold MapPin:MapPin Menu:List MessagesSquare:ChatsCircle Moon:Moon Navigation:NavigationArrow PackageCheck:Package Paperclip:Paperclip Pencil:PencilSimple
Plus:Plus PlusCircle:PlusCircle Receipt:Receipt RefreshCw:ArrowsClockwise RotateCcw:ArrowCounterClockwise RotateCw:ArrowClockwise Save:FloppyDisk Search:MagnifyingGlass Send:PaperPlaneTilt
ServerCrash:HardDrives Settings:GearSix ShieldCheck:ShieldCheck SlidersHorizontal:SlidersHorizontal Sprout:Plant Square:Square Star:Star Sun:Sun Trash2:Trash Upload:UploadSimple
UserCog:UserGear UserPlus:UserPlus UserRound:User Users:Users Wallet:Wallet WifiOff:WifiSlash X:X XCircle:XCircle Zap:Lightning ZoomIn:MagnifyingGlassPlus ZoomOut:MagnifyingGlassMinus`
  .split(/\s+/).filter(Boolean).map((p) => p.split(':'));
const kebab = (s) => s.replace(/^([A-Z])([A-Z])/, '$1-$2').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const inner = (file) => { const s = fs.readFileSync(file, 'utf8'); const m = s.match(/<svg[^>]*>([\s\S]*)<\/svg>/); if (!m) throw new Error('bad svg ' + file); return m[1].trim().replace(/\s+/g, ' '); };
const base = REPO + 'node_modules/@phosphor-icons/core/assets/';   // الحزمة مرفوعة لجذر الـworkspaces
const FILLED = new Set(['Star']);   // أيقونات تُستعمل بنسختها المعبّأة أيضاً (fill)
const rows = MAP.map(([n, p]) => {
  const b = inner(`${base}bold/${kebab(p)}-bold.svg`);
  const f = FILLED.has(n) ? inner(`${base}fill/${kebab(p)}-fill.svg`) : null;
  return `export const ${n} = mk('${n}', ${JSON.stringify(b)}${f ? ', ' + JSON.stringify(f) : ''});`;
});
const out = `import { forwardRef } from 'react';

/* الأيقونات: مجموعة Phosphor (وزن bold واحد موحّد) مضمّنة كمسارات SVG جاهزة، فلا تُحمَّل أوزان غير مستعملة.
   واجهة الاستخدام: size و className كما قبل، و fill لعرض النسخة المعبّأة حيث توجد.
   ملف مولَّد: الاسم القديم ← أيقونة Phosphor (انظر tools/gen-icons.mjs). */
const mk = (name, bold, filled) => {
  const Icon = forwardRef(function Icon({ size = 20, strokeWidth: _s, absoluteStrokeWidth: _a, fill, ...rest }, ref) {
    return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden="true" focusable="false" {...rest} dangerouslySetInnerHTML={{ __html: fill && filled ? filled : bold }} />;
  });
  Icon.displayName = name; return Icon;
};

${rows.join('\n')}
`;
fs.writeFileSync(ROOT + 'src/icons.jsx', out, 'utf8');
console.log(MAP.length, 'icons,', Math.round(out.length / 1024), 'KB source');
