import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme.dart';
import '../../../models/design_placement.dart';
import '../../../models/print_metadata.dart';

class DesignPlacementResult {
  DesignPlacementResult({required this.placement, required this.previewPngBytes});
  final DesignPlacement placement;
  final Uint8List previewPngBytes;
}

/// Pick a photo, then drag/pinch/rotate it over the product mockup for one
/// print location. The simplified mobile equivalent of the web's
/// multi-location Konva editor (per the scope decided for this app): one
/// location, one gesture-driven transform, composited with a
/// RepaintBoundary capture — the Flutter analogue of Konva's
/// stage.toCanvas().
class DesignPlacementSheet extends StatefulWidget {
  const DesignPlacementSheet({super.key, required this.location});
  final PrintLocation location;

  static Future<DesignPlacementResult?> show(BuildContext context, PrintLocation location) {
    return showModalBottomSheet<DesignPlacementResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (_) => DesignPlacementSheet(location: location),
    );
  }

  @override
  State<DesignPlacementSheet> createState() => _DesignPlacementSheetState();
}

class _DesignPlacementSheetState extends State<DesignPlacementSheet> {
  static const _boxSize = 320.0;

  final _repaintKey = GlobalKey();
  Uint8List? _imageBytes;
  String? _filename;
  String? _mimeType;

  double _scale = 0.6;
  double _rotation = 0;
  Offset _offset = Offset.zero;

  double _baseScale = 1;
  double _baseRotation = 0;
  Offset _baseOffset = Offset.zero;
  Offset? _startFocalPoint;

  bool _submitting = false;
  String? _error;

  Future<void> _pickImage() async {
    final file = await ImagePicker().pickImage(source: ImageSource.gallery, imageQuality: 92);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    final ext = file.name.contains('.') ? file.name.split('.').last.toLowerCase() : 'jpg';
    setState(() {
      _imageBytes = bytes;
      _filename = file.name;
      _mimeType = switch (ext) {
        'png' => 'image/png',
        'webp' => 'image/webp',
        _ => 'image/jpeg',
      };
      _scale = 0.6;
      _rotation = 0;
      _offset = Offset.zero;
      _error = null;
    });
  }

  Future<void> _confirm() async {
    if (_imageBytes == null) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final boundary = _repaintKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 2.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      final previewBytes = byteData!.buffer.asUint8List();

      final area = widget.location.area ?? DesignArea.fallback;
      // Map the on-screen offset (pixels within the preview box) into the
      // print area's own coordinate space, so the value means the same
      // thing it would if this had come from the web's Konva stage.
      final posX = area.x + (_offset.dx / _boxSize) * area.width;
      final posY = area.y + (_offset.dy / _boxSize) * area.height;

      final placement = DesignPlacement(
        location: widget.location,
        originalBytes: _imageBytes!,
        originalFilename: _filename ?? 'design.jpg',
        originalMimeType: _mimeType ?? 'image/jpeg',
        offsetX: posX,
        offsetY: posY,
        scale: _scale,
        rotationDegrees: _rotation * 180 / 3.141592653589793,
      );

      if (!mounted) return;
      Navigator.of(context).pop(DesignPlacementResult(placement: placement, previewPngBytes: previewBytes));
    } catch (e) {
      setState(() => _error = 'Could not process your design: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bytes = _imageBytes;
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Upload your design', style: Theme.of(context).textTheme.titleLarge),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.of(context).pop()),
                ],
              ),
              Text(
                widget.location.label ?? widget.location.key,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              Center(
                child: RepaintBoundary(
                  key: _repaintKey,
                  child: Container(
                    width: _boxSize,
                    height: _boxSize,
                    clipBehavior: Clip.hardEdge,
                    decoration: BoxDecoration(
                      color: AppColors.creamTile,
                      border: Border.all(color: AppColors.greyLines),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Stack(
                      children: [
                        if ((widget.location.mockupUrl ?? '').isNotEmpty)
                          Positioned.fill(
                            child: CachedNetworkImage(imageUrl: widget.location.mockupUrl!, fit: BoxFit.cover),
                          ),
                        if (bytes != null)
                          GestureDetector(
                            onScaleStart: (details) {
                              _startFocalPoint = details.focalPoint;
                              _baseScale = _scale;
                              _baseRotation = _rotation;
                              _baseOffset = _offset;
                            },
                            onScaleUpdate: (details) {
                              setState(() {
                                _scale = (_baseScale * details.scale).clamp(0.1, 4.0);
                                _rotation = _baseRotation + details.rotation;
                                _offset = _baseOffset + (details.focalPoint - _startFocalPoint!);
                              });
                            },
                            child: Center(
                              child: Transform.translate(
                                offset: _offset,
                                child: Transform.rotate(
                                  angle: _rotation,
                                  child: Transform.scale(
                                    scale: _scale,
                                    child: Image.memory(bytes, width: 160, height: 160, fit: BoxFit.contain),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                bytes == null ? 'PNG, JPG or WebP up to 10 MB' : 'Drag, pinch, and rotate with two fingers to position it',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 16),
              if (_error != null) ...[
                Text(_error!, style: const TextStyle(color: AppColors.error)),
                const SizedBox(height: 12),
              ],
              OutlinedButton.icon(
                onPressed: _pickImage,
                icon: const Icon(Icons.upload_outlined),
                label: Text(bytes == null ? 'Choose a photo' : 'Replace photo'),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: bytes == null || _submitting ? null : _confirm,
                child: _submitting
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Use this design'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
