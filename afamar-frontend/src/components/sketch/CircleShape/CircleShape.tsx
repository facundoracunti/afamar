import { Circle } from 'react-konva';
import type Konva from 'konva';
import type { SketchCircle } from '@/types/sketch';

interface CircleShapeProps {
  element: SketchCircle;
  isDraggable: boolean;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>, id: string) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  onSelect: (id: string) => void;
}

export default function CircleShape({ element, isDraggable, onDragEnd, onTransformEnd, onSelect }: CircleShapeProps) {
  return (
    <Circle
      id={element.id}
      x={element.cx}
      y={element.cy}
      radius={element.radius}
      stroke={element.stroke}
      strokeWidth={element.strokeWidth}
      dash={element.dash}
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