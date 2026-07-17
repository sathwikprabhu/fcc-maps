import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

export function ColorPicker({ value, onChange }: { value: string; onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const HUES = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  
  const hslToHex = (h: number, s: number, l: number) => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      const hex = Math.round(255 * color).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const presetColors = HUES.map(h => hslToHex(h, 100, 35));

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1.5 border rounded-md hover:bg-muted/50 transition-colors w-full justify-between"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full border shadow-sm"
            style={{ backgroundColor: value }}
          />
          <span className="text-xs text-muted-foreground font-mono uppercase">{value}</span>
        </div>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 z-50 p-3 bg-popover text-popover-foreground border rounded-md shadow-md w-48">
          <div className="grid grid-cols-4 gap-2">
            {presetColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onChange(color);
                  setIsOpen(false);
                }}
                className={`w-6 h-6 rounded-full border transition-all hover:scale-110 active:scale-95 ${
                  value.toLowerCase() === color.toLowerCase()
                    ? 'ring-2 ring-offset-2 ring-foreground border-foreground scale-110'
                    : 'border-muted hover:border-foreground/50'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
