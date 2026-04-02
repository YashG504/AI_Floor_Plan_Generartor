import { useMemo } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, DoorOpen } from 'lucide-react';

const FloorPlanViewer = ({ imageSrc, length, breadth, entryDirection }) => {
  // Generate tick marks for rulers
  const xTicks = useMemo(() => {
    const step = length <= 20 ? 2 : length <= 50 ? 5 : 10;
    const ticks = [];
    for (let i = 0; i <= length; i += step) {
      ticks.push(i);
    }
    if (ticks[ticks.length - 1] !== length) ticks.push(length);
    return ticks;
  }, [length]);

  const yTicks = useMemo(() => {
    const step = breadth <= 20 ? 2 : breadth <= 50 ? 5 : 10;
    const ticks = [];
    for (let i = 0; i <= breadth; i += step) {
      ticks.push(i);
    }
    if (ticks[ticks.length - 1] !== breadth) ticks.push(breadth);
    return ticks;
  }, [breadth]);

  const entryArrow = {
    'East': { side: 'right', Icon: ArrowLeft, label: 'East Entry' },
    'West': { side: 'left', Icon: ArrowRight, label: 'West Entry' },
  }[entryDirection] || { side: 'right', Icon: ArrowLeft, label: 'East Entry' };

  const entryPositionClasses = {
    'left': 'left-0 top-1/2 -translate-y-1/2 -translate-x-full flex-row-reverse',
    'right': 'right-0 top-1/2 -translate-y-1/2 translate-x-full flex-row',
  };

  return (
    <div className="flex flex-col items-center w-full gap-2">
      {/* Dimension Label */}
      <div className="flex items-center gap-3 mb-2">
        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-600">
          {length} ft × {breadth} ft = {length * breadth} sq ft
        </span>
      </div>

      {/* Main container: Y-axis + Image + Entry markers */}
      <div className="flex items-stretch gap-0">
        {/* Y-Axis Ruler (Left) */}
        <div className="flex flex-col justify-between items-end pr-1 py-0" style={{ minWidth: '40px' }}>
          <span className="text-[9px] font-mono text-blue-500 dark:text-blue-400 -mt-1">0</span>
          <div className="flex-1 relative w-full">
            {yTicks.slice(1, -1).map((tick) => (
              <div
                key={tick}
                className="absolute right-0 flex items-center gap-0.5"
                style={{ top: `${(tick / breadth) * 100}%`, transform: 'translateY(-50%)' }}
              >
                <span className="text-[8px] font-mono text-slate-500 dark:text-slate-400">{tick}</span>
                <div className="w-2 h-px bg-slate-400 dark:bg-slate-500" />
              </div>
            ))}
            {/* Vertical ruler line */}
            <div className="absolute right-0 top-0 bottom-0 w-px bg-blue-400 dark:bg-blue-500" />
          </div>
          <span className="text-[9px] font-mono text-blue-500 dark:text-blue-400 -mb-1">{breadth}</span>
        </div>

        {/* Column: X-axis top + Image + X-axis bottom */}
        <div className="flex flex-col gap-0">
          {/* X-Axis Ruler (Top) */}
          <div className="relative h-5 ml-0" style={{ width: '100%' }}>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-blue-400 dark:bg-blue-500" />
            {xTicks.map((tick) => (
              <div
                key={tick}
                className="absolute bottom-0 flex flex-col items-center"
                style={{ left: `${(tick / length) * 100}%`, transform: 'translateX(-50%)' }}
              >
                <span className="text-[8px] font-mono text-slate-500 dark:text-slate-400 mb-0.5">{tick}</span>
                <div className="h-2 w-px bg-slate-400 dark:bg-slate-500" />
              </div>
            ))}
          </div>

          {/* Y-axis label (left side, rotated) */}


          {/* Image with entry gate overlay */}
          <div className="relative w-full" style={{ aspectRatio: `${length} / ${breadth}`, maxHeight: '85vh' }}>
            <img
              src={imageSrc}
              alt="Generated Floor Plan"
              className="w-full h-full object-cover rounded-lg shadow-2xl border-2 border-blue-200 dark:border-blue-700"
              style={{ display: 'block' }}
            />

            {/* Entry Gate Indicator */}
            <div className={`absolute ${entryPositionClasses[entryArrow.side]} flex items-center gap-1 z-20`}>
              <div className="flex items-center gap-1 bg-emerald-500 text-white px-2 py-1 rounded-full shadow-lg text-[10px] font-bold whitespace-nowrap">
                <DoorOpen size={12} />
                <entryArrow.Icon size={12} />
                <span>{entryArrow.label}</span>
              </div>
            </div>
          </div>

          {/* X-Axis Ruler (Bottom) */}
          <div className="relative h-5 ml-0" style={{ width: '100%' }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-blue-400 dark:bg-blue-500" />
            {xTicks.map((tick) => (
              <div
                key={tick}
                className="absolute top-0 flex flex-col items-center"
                style={{ left: `${(tick / length) * 100}%`, transform: 'translateX(-50%)' }}
              >
                <div className="h-2 w-px bg-slate-400 dark:bg-slate-500" />
                <span className="text-[8px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">{tick}</span>
              </div>
            ))}
          </div>

          {/* Axis Labels */}
          <div className="flex justify-center mt-1">
            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
              ← Length ({length} ft) →
            </span>
          </div>
        </div>

        {/* Y-Axis Label (right side) */}
        <div className="flex items-center justify-center pl-2" style={{ writingMode: 'vertical-rl' }}>
          <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            ← Breadth ({breadth} ft) →
          </span>
        </div>
      </div>
    </div>
  );
};

export default FloorPlanViewer;
