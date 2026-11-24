import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text as KonvaText, Line, Group } from 'react-konva';
import useImage from 'use-image';

interface ImageEditorModalProps {
 initialImageBase64: string;
 onSave: (newImageBase64: string) => void;
 onClose: () => void;
}

type Tool = 'select' | 'text' | 'rect' | 'draw';

interface Shape {
 id: string;
 type: Tool;
 x?: number;
 y?: number;
 width?: number;
 height?: number;
 fill?: string;
 text?: string;
 fontSize?: number;
 points?: number[];
 stroke?: string;
 strokeWidth?: number;
}

const ImageEditorModal: React.FC<ImageEditorModalProps> = ({ initialImageBase64, onSave, onClose }) => {
 const [image] = useImage(initialImageBase64);
 const stageRef = useRef<any>(null);
 
 const [tool, setTool] = useState<Tool>('select');
 const [shapes, setShapes] = useState<Shape[]>([]);
 const [selectedId, setSelectedId] = useState<string | null>(null);
 const [isDrawing, setIsDrawing] = useState(false);
 const [color, setColor] = useState('#000000');
 
 const [stageWidth, setStageWidth] = useState(800);
 const [stageHeight, setStageHeight] = useState(600);
 
 useEffect(() => {
 if (image) {
 // Scale stage to fit image but keep within max limits
 const maxWidth = window.innerWidth * 0.8;
 const maxHeight = window.innerHeight * 0.7;
 let ratio = Math.min(maxWidth / image.width, maxHeight / image.height);
 if (ratio > 1) ratio = 1; // don't upscale too much
 setStageWidth(image.width * ratio);
 setStageHeight(image.height * ratio);
 }
 }, [image]);

 const checkDeselect = (e: any) => {
 const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'background-image';
 if (clickedOnEmpty) {
 setSelectedId(null);
 }
 };

 const handleMouseDown = (e: any) => {
 checkDeselect(e);
 if (tool === 'select') return;

 if (tool === 'text') {
 const pos = e.target.getStage().getPointerPosition();
 const newText = prompt('Enter text:');
 if (newText) {
 setShapes([...shapes, {
 id: Date.now().toString(),
 type: 'text',
 x: pos.x,
 y: pos.y,
 text: newText,
 fill: color,
 fontSize: 20
 }]);
 }
 setTool('select');
 return;
 }

 if (tool === 'rect') {
 const pos = e.target.getStage().getPointerPosition();
 const newShape: Shape = {
 id: Date.now().toString(),
 type: 'rect',
 x: pos.x,
 y: pos.y,
 width: 0,
 height: 0,
 fill: '#ffffff' // Default white rectangle for covering labels
 };
 setShapes([...shapes, newShape]);
 setIsDrawing(true);
 }

 if (tool === 'draw') {
 setIsDrawing(true);
 const pos = e.target.getStage().getPointerPosition();
 setShapes([...shapes, {
 id: Date.now().toString(),
 type: 'draw',
 points: [pos.x, pos.y],
 stroke: color,
 strokeWidth: 5
 }]);
 }
 };

 const handleMouseMove = (e: any) => {
 if (!isDrawing) return;

 const stage = e.target.getStage();
 const point = stage.getPointerPosition();
 let lastShape = { ...shapes[shapes.length - 1] };

 if (tool === 'rect') {
 lastShape.width = point.x - (lastShape.x || 0);
 lastShape.height = point.y - (lastShape.y || 0);
 } else if (tool === 'draw') {
 lastShape.points = lastShape.points?.concat([point.x, point.y]);
 }

 const newShapes = [...shapes];
 newShapes[shapes.length - 1] = lastShape;
 setShapes(newShapes);
 };

 const handleMouseUp = () => {
 setIsDrawing(false);
 };

 const handleDelete = () => {
 if (selectedId) {
 setShapes(shapes.filter(s => s.id !== selectedId));
 setSelectedId(null);
 }
 };

 const handleSave = () => {
 setSelectedId(null); // Deselect before exporting
 setTimeout(() => {
 const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
 onSave(uri);
 }, 100);
 };

 return (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
 <div className="bg-white rounded-2xl overflow-hidden flex flex-col w-[90vw] h-[90vh]">
 <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
 <h3 className="text-lg font-bold text-slate-800">Edit Image</h3>
 
 <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-slate-200 ">
 <button onClick={() => setTool('select')} className={`px-3 py-1 rounded-md text-sm font-medium ${tool === 'select' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>Select</button>
 <button onClick={() => setTool('rect')} className={`px-3 py-1 rounded-md text-sm font-medium ${tool === 'rect' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>Cover Label (White Box)</button>
 <button onClick={() => setTool('text')} className={`px-3 py-1 rounded-md text-sm font-medium ${tool === 'text' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>Edit/Add Text</button>
 <button onClick={() => setTool('draw')} className={`px-3 py-1 rounded-md text-sm font-medium ${tool === 'draw' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}>Pen</button>
 
 <div className="w-px h-6 bg-gray-300 mx-2"></div>
 
 <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded border-none cursor-pointer" title="Tool Color" />
 <button onClick={handleDelete} disabled={!selectedId} className={`px-3 py-1 rounded-md text-sm font-medium ${selectedId ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 cursor-not-allowed'}`}>Delete Selected</button>
 </div>

 <div className="flex space-x-2">
 <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">Cancel</button>
 <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors">Save Changes</button>
 </div>
 </div>
 
 <div className="flex-1 overflow-auto p-4 bg-gray-100 flex items-center justify-center">
 <div className="bg-white " style={{width: stageWidth, height: stageHeight}}>
 {image && (
 <Stage
 width={stageWidth}
 height={stageHeight}
 onMouseDown={handleMouseDown}
 onMousemove={handleMouseMove}
 onMouseup={handleMouseUp}
 ref={stageRef}
 >
 <Layer>
 <KonvaImage 
 image={image} 
 width={stageWidth} 
 height={stageHeight} 
 name="background-image"
 />
 {shapes.map((shape, i) => {
 const isSelected = shape.id === selectedId;
 if (shape.type === 'rect') {
 return (
 <Rect
 key={shape.id}
 x={shape.x}
 y={shape.y}
 width={shape.width}
 height={shape.height}
 fill={shape.fill}
 stroke={isSelected ? '#3b82f6' : undefined}
 strokeWidth={isSelected ? 2 : 0}
 draggable={tool === 'select'}
 onClick={() => tool === 'select' && setSelectedId(shape.id)}
 onDragEnd={(e) => {
 const newShapes = [...shapes];
 newShapes[i] = { ...shape, x: e.target.x(), y: e.target.y() };
 setShapes(newShapes);
 }}
 />
 );
 }
 if (shape.type === 'text') {
 return (
 <Group 
 key={shape.id} 
 x={shape.x} 
 y={shape.y}
 draggable={tool === 'select'}
 onClick={() => tool === 'select' && setSelectedId(shape.id)}
 onDragEnd={(e) => {
 const newShapes = [...shapes];
 newShapes[i] = { ...shape, x: e.target.x(), y: e.target.y() };
 setShapes(newShapes);
 }}
 >
 <Rect
 width={shape.text ? shape.text.length * (shape.fontSize || 20) * 0.6 : 50}
 height={(shape.fontSize || 20) * 1.5}
 fill={shape.text ? 'rgba(255,255,255,0.7)' : 'transparent'}
 stroke={isSelected ? '#3b82f6' : undefined}
 strokeWidth={isSelected ? 2 : 0}
 cornerRadius={4}
 offsetY={-2}
 offsetX={-2}
 />
 <KonvaText
 text={shape.text}
 fontSize={shape.fontSize}
 fill={shape.fill}
 padding={5}
 width={shape.text ? shape.text.length * (shape.fontSize || 20) * 0.6 : 50}
 align="center"
 />
 </Group>
 );
 }
 if (shape.type === 'draw') {
 return (
 <Line
 key={shape.id}
 points={shape.points || []}
 stroke={shape.stroke}
 strokeWidth={shape.strokeWidth}
 tension={0.5}
 lineCap="round"
 lineJoin="round"
 draggable={tool === 'select'}
 onClick={() => tool === 'select' && setSelectedId(shape.id)}
 onDragEnd={(e) => {
 // Konva doesn't easily return offset points on lines drag correctly in this context unless managed carefully,
 // But it translates them if x/y changes. We can just keep it draggable.
 }}
 />
 );
 }
 return null;
 })}
 </Layer>
 </Stage>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default ImageEditorModal;
