'use client';

import { useState } from 'react';
import { Upload, Info, Undo, Redo, Circle } from 'lucide-react';
import { ChevronDown, ChevronLeft } from "lucide-react"


export default function TShirtDesigner() {
    const [selectedTech, setSelectedTech] = useState('printing');
    const [selectedColor, setSelectedColor] = useState('white');
    const [selectedSize, setSelectedSize] = useState('S');
    const [selectedView, setSelectedView] = useState('front');

    const colors = [
        { name: 'white', hex: '#FFFFFF' },
        { name: 'gray', hex: '#6B7280' },
        { name: 'blue', hex: '#3B82F6' },
        { name: 'black', hex: '#000000' }
    ];

    const sizes = ['S', 'M', 'L', 'XL', '2XL'];

    const views = [
        { id: 'front', label: 'Front' },
        { id: 'back', label: 'Back' },
        { id: 'inner', label: 'Inner neck' },
        { id: 'outer', label: 'Outer neck' },
        { id: 'left', label: 'Left sleeve' },
        { id: 'right', label: 'Right sleeve' }
    ];

    return (

         <div className="flex h-screen bg-white">
            {/* Far Left Toolbar */}
            <div className="w-16 mx-auto px-2 bg-white flex flex-col items-center py-4 gap-1">
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Product"
                >
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-[10px]">Back</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Product"
                >
                    <Upload className="w-5 h-5" />
                    <span className="text-[10px]">Product</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Files"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className="text-[10px]">Files</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Text"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                    </svg>
                    <span className="text-[10px]">Text</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Templates"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                    </svg>
                    <span className="text-[10px]">Templates</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Graphics"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px]">Graphics</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Layers"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <span className="text-[10px]">Layers</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Shutterstock"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[10px]">Shutterstock</span>
                </button>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Shapes"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="3" strokeWidth={2} />
                        <rect x="5" y="5" width="6" height="6" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 8l-3 5 3 5" />
                    </svg>
                    <span className="text-[10px]">Shapes</span>
                </button>
                <div className="flex-1"></div>
                <button
                    className="w-12 h-12 flex flex-col items-center justify-center hover:bg-gray-100 rounded gap-1 text-gray-700"
                    title="Settings"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span className="text-[10px]">Settings</span>
                </button>
            </div>

            {/* Left Sidebar - Design Tools */}
            <div className="w-80 border-r border-gray-200 p-6 overflow-y-auto">


                {/* Product Info */}
                <div className="mb-2">
                    <h2 className="font-semibold text-base mb-1">
                        Organic Unisex Crewneck T-shirt | Econscious EC1000
                    </h2>
                    <p className="text-sm text-gray-600">Top selling Embroidery Product</p>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <h3 className="font-semibold text-sm mb-2">Make your design stand out</h3>
                    <p className="text-sm text-gray-700">
                        Add prints to multiple areas to create a premium, branded look.{' '}
                        <a href="#" className="text-blue-600 hover:underline">Learn More</a>
                    </p>
                </div>

                {/* Technology Selection */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <label className="text-sm font-medium">Technology</label>
                        <Info className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setSelectedTech('printing')}
                            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
                                selectedTech === 'printing'
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Printing
                        </button>
                        <button
                            onClick={() => setSelectedTech('embroidery')}
                            className={`flex-1 py-2 px-4 rounded text-sm font-medium transition-colors ${
                                selectedTech === 'embroidery'
                                    ? 'bg-gray-900 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Embroidery
                        </button>
                    </div>
                </div>

                {/* Color Selection */}
                <div className="mb-6">
                    <label className="text-sm font-medium block mb-3">Color</label>
                    <div className="flex gap-2">
                        {colors.map((color) => (
                            <button
                                key={color.name}
                                onClick={() => setSelectedColor(color.name)}
                                className={`w-10 h-10 rounded border-2 transition-all ${
                                    selectedColor === color.name
                                        ? 'border-gray-900 scale-110'
                                        : 'border-gray-300 hover:border-gray-400'
                                }`}
                                style={{ backgroundColor: color.hex }}
                                aria-label={color.name}
                            />
                        ))}
                    </div>
                </div>

                {/* Size Selection */}
                <div className="mb-6">
                    <label className="text-sm font-medium block mb-3">Size</label>
                    <div className="flex gap-2">
                        {sizes.map((size) => (
                            <button
                                key={size}
                                onClick={() => setSelectedSize(size)}
                                className={`px-4 py-2 rounded border text-sm font-medium transition-colors ${
                                    selectedSize === size
                                        ? 'border-gray-900 bg-gray-900 text-white'
                                        : 'border-gray-300 bg-white hover:border-gray-400'
                                }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                </div>


            </div>

            {/* Center - Product Preview */}
            <div className="flex-1 flex flex-col">
                {/* Top Toolbar */}
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-gray-100 rounded">
                            <Info className="w-5 h-5" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded">
                            <Undo className="w-5 h-5" />
                        </button>
                        <button className="p-2 hover:bg-gray-100 rounded">
                            <Redo className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="px-6 py-2 border border-gray-500 text-sm rounded-lg hover:bg-gray-800 font-medium">
                            Preview
                        </button>
                        <button className="px-6 py-2 border border-gray-500 text-sm  rounded-lg hover:bg-gray-800 font-medium">
                           + Save design
                        </button>
                                <span className="flex text-xl font-bold">£17.52 <ChevronDown /></span>
                                <button className="flex px-4 py-1 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 font-medium">
                                    Add to order

                                </button>
                    </div>
                </div>

                {/* Product Image */}
                <div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
                    <div className="relative">
                        <div className="w-[500px] h-[600px] bg-white rounded-lg shadow-lg flex items-center justify-center">
                            {/* Placeholder for t-shirt mockup */}
                            <div className="text-center">
                                <div className="w-64 h-64 mx-auto bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                    <Upload className="w-16 h-16 text-gray-400" />
                                </div>
                                <h3 className="text-xl font-semibold mb-2">Drop your design here</h3>
                                <p className="text-gray-600">Or use the 'Add new' button</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom - Design Placements */}
                <div className="content-container p-4">
                    <div className="flex gap-3 justify-center">
                        {views.map((view) => (
                            <button
                                key={view.id}
                                onClick={() => setSelectedView(view.id)}
                                className={`flex flex-col items-center gap-2 p-3 rounded transition-colors ${
                                    selectedView === view.id
                                        ? 'bg-gray-100 border-2 border-gray-900'
                                        : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                                }`}
                            >
                                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center">
                                    <div className="w-12 h-12 bg-white rounded" />
                                </div>
                                <span className="text-xs font-medium">{view.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}