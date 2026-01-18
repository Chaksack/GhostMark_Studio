Role & Context
You are a senior full-stack engineer specializing in Medusa.js (Node.js), Medusa Admin (React), and Fabric.js for Print-On-Demand (POD) ecommerce systems.

I am building a POD ecommerce platform using Medusa. Products with product type = "POD" must use a Fabric.js design tool with admin-defined print areas.

🎯 OBJECTIVES

Implement a complete POD customization system with:

Fabric.js designer integration (storefront)

Admin-controlled print areas

Visual Medusa Admin UI for drawing print areas

Front / Back / Sleeve toggle support

Unit conversion (cm → px)

Design & print area versioning

🧵 FUNCTIONAL REQUIREMENTS
1️⃣ POD Product Detection

Use Medusa Product Type = "POD"

Only POD products trigger the designer

Non-POD products follow normal add-to-cart flow

2️⃣ Print Area Data Model

Design a print area schema stored on the product (or variant) that supports:

Multiple sides: front, back, left_sleeve, right_sleeve

Units stored in centimeters

DPI awareness (default 300)

Example structure:

{
"pod": {
"print_areas": {
"front": {
"x_cm": 5,
"y_cm": 7,
"width_cm": 28,
"height_cm": 36,
"dpi": 300,
"version": 1
}
}
}
}

3️⃣ Medusa Admin – Visual Print Area Editor

Build a custom Medusa Admin plugin/page that:

Appears only for POD products

Displays the product mockup image

Uses Fabric.js or Konva.js to:

Draw printable rectangles

Resize & reposition print areas

Supports side switching:

Front / Back / Sleeve

Saves print areas into product metadata

Automatically increments a print area version

Admin UX:

Product → POD Print Areas
├── Front
├── Back
├── Left Sleeve
└── Right Sleeve

4️⃣ Unit Conversion (cm → px)

Implement a shared utility:

cmToPx(cm: number, dpi: number): number


Use DPI = 300 by default

Ensure canvas resolution is print-safe

Convert admin-defined areas into Fabric.js clip paths

5️⃣ Storefront Fabric.js Designer

Load print areas dynamically from Medusa

Apply selected side’s print area as a Fabric.js clipPath

Prevent design elements outside printable zone

Support side switching (front/back/sleeve)

6️⃣ Design Saving & Versioning

When a customer saves a design:

Store:

Canvas JSON

Preview image

Product ID

Variant ID

Side (front/back/sleeve)

Print area version

Design version

Increment design version on each save

Lock versions after checkout

7️⃣ Order & Production Safety

Attach design metadata to Medusa line items

Ensure print area version used at design time is immutable

Export print-ready files at 300 DPI

Support PNG and PDF output

🏗️ TECHNICAL CONSTRAINTS

Medusa backend (Node.js)

Medusa Admin (React)

Storefront (Next.js or React)

Fabric.js for canvas rendering

Follow Medusa best practices:

Metadata

Services

Subscribers

📦 DELIVERABLES

Generate:

Backend models & services

Admin UI code (React)

Storefront Fabric.js components

Unit conversion utilities

Versioning logic

Folder structure

Example API calls

Code must be:

Production-ready

Typed (TypeScript)

Modular

Scalable

🚫 DO NOT

Hardcode print areas

Allow POD products without print areas

Allow design edits after payment

✅ EXPECTED OUTPUT

A complete, end-to-end POD customization implementation compatible with Medusa, ready for real-world production and scaling.

Think like a production engineer, not a demo tutorial.

Begin implementation now.