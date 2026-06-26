import { Line } from 'react-konva';
import type Konva from 'konva';
import type { CroquisLine } from '../../../types/croquis';

interface LineShapeProps {
  element: CroquisLine;
  isDraggable: boolean;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>, id: string) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  onSelect: (id: string) => void;
}

export default function LineShape({ element, isDraggable, onDragEnd, onTransformEnd, onSelect }: LineShapeProps) {
  return (
    <Line
      id={element.id}
      points={element.points}
      x={element.x || 0}
      y={element.y || 0}
      stroke={element.stroke}
      strokeWidth={element.strokeWidth}
      lineCap="round"
      lineJoin="round"
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
