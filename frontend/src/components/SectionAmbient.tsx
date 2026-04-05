import { memo } from "react";

// 1. Định nghĩa kiểu dữ liệu cho Props
interface SectionAmbientProps {
  style?: string;
}

// 2. Bóc tách { style } từ props và gán giá trị mặc định là "brand"
const SectionAmbient = memo(({ style = "brand" }: SectionAmbientProps) => (
  <div
    className="absolute inset-0 overflow-hidden pointer-events-none"
    aria-hidden="true"
  >
    <div
      className={`orb-float orb-float--${style} orb-float--lg absolute -top-32 -left-24 w-80 h-80 opacity-[0.07]`}
    />
    <div
      className={`orb-float orb-float--${style} orb-float--slow absolute -bottom-24 -right-10 w-50 h-64 opacity-[0.06]`}
    />
  </div>
));

SectionAmbient.displayName = "SectionAmbient";

export default SectionAmbient;
