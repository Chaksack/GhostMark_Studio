import 'print_metadata.dart';

/// The placement the user ends up with after dragging/pinching/rotating
/// their picked photo over a print location's mockup. Mirrors the shape
/// DesignEditor.vue's sidePayload() builds (its `position`/`scale`/
/// `rotation` fields) so the admin's "Uploaded designs" widget renders this
/// exactly like a web-submitted design — same contract, same renderer.
class DesignPlacement {
  DesignPlacement({
    required this.location,
    required this.originalBytes,
    required this.originalFilename,
    required this.originalMimeType,
    required this.offsetX,
    required this.offsetY,
    required this.scale,
    required this.rotationDegrees,
  });

  final PrintLocation location;
  final List<int> originalBytes;
  final String originalFilename;
  final String originalMimeType;

  /// Center position of the design within the print area, in the same
  /// area-local coordinate space area.x/area.y/area.width/area.height use.
  final double offsetX;
  final double offsetY;
  final double scale;
  final double rotationDegrees;
}
