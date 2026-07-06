import { Rect } from 'react-konva';
import type Konva from 'konva';
import type { SketchRect, SketchCutout } from '@/types/sketch';

interface RectangleShapeProps {
  element: SketchRect | SketchCutout;
  isDraggable: boolean;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>, id: string) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  onSelect: (id: string) => void;
}

export default function RectangleShape({ element, isDraggable, onDragEnd, onTransformEnd, onSelect }: RectangleShapeProps) {
  return (
    <Rect
      id={element.id}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      fill={element.fill || 'transparent'}
      stroke={element.stroke}
      strokeWidth={element.strokeWidth}
      dash={element.dash}
      rotation={element.rotation || 0}
      draggable={isDraggable}
      listening={true}
      hitStrokeWidth={20}
      onClick={() => onSelect(element.id)}
      onTap={() => onSelect(element.id)}
      onDragEnd={(e) => onDragEnd(e, element.id)}
      onTransformEnd={onTransformEnd}
    />
  );
}