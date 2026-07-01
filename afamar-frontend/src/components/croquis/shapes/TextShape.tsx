import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CroquisText } from '../../../types/croquis';

interface TextShapeProps {
  element: CroquisText;
  isDraggable: boolean;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>, id: string) => void;
  onTransformEnd: (e: Konva.KonvaEventObject<Event>) => void;
  onSelect: (id: string) => void;
}

export default function TextShape({ element, isDraggable, onDragEnd, onTransformEnd, onSelect }: TextShapeProps) {
  const approxW = Math.max(100, (element.fontSize || 16) * (element.text?.length || 5) * 0.55 + 16);
  const approxH = (element.fontSize || 16) * 1.5;

  return (
    <Group
      id={element.id}
      x={element.x}
      y={element.y}
      rotation={element.rotation || 0}
      draggable={isDraggable}
      onDragEnd={(e) => onDragEnd(e, element.id)}
      onTransformEnd={onTransformEnd}
    >
      <Rect
        x={0}
        y={0}
        width={approxW}
        height={approxH}
        fill="transparent"
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
      />
      <Text
        x={0}
        y={0}
        text={element.text}
        fontSize={element.fontSize}
        fill={element.fill}
        listening={false}
      />
    </Group>
  );
}
