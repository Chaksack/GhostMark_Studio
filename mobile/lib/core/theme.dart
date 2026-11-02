import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Mirrors storefront/tailwind.config.ts — same palette + type pairing
/// (Fraunces display serif, Inter Tight body) so the app reads as the
/// same brand as the web storefront.
class AppColors {
  static const offWhite = Color(0xFFF1EEE9);
  static const creamTile = Color(0xFFF4F1EB);
  static const greyLines = Color(0xFFD9D2C5);
  static const greyText = Color(0xFF6A6258);
  static const terracotta = Color(0xFFC46B4F);

  // ink scale (headline/body/neutral)
  static const ink950 = Color(0xFF141210);
  static const ink700 = Color(0xFF3F3A33);
  static const ink500 = Color(0xFF68645A);
  static const ink300 = Color(0xFFB0ABA1);
  static const ink100 = Color(0xFFEBE9E5);

  static const sage500 = Color(0xFF818D50);
  static const error = Color(0xFFD43A2F);
}

class AppTheme {
  static ThemeData get light {
    // google_fonts' *TextTheme() helpers return material_ui's TextTheme in
    // this Flutter version, which isn't the flutter/material.dart TextTheme
    // ThemeData expects — so build off the base TextTheme and apply fonts
    // per-style via GoogleFonts.fraunces()/interTight(), which return plain
    // TextStyle and stay on the right type.
    final base = Typography.material2021(platform: TargetPlatform.iOS).black;

    final textTheme = base.copyWith(
      displayLarge: GoogleFonts.fraunces(textStyle: base.displayLarge, color: AppColors.ink950),
      displayMedium: GoogleFonts.fraunces(textStyle: base.displayMedium, color: AppColors.ink950),
      displaySmall: GoogleFonts.fraunces(textStyle: base.displaySmall, color: AppColors.ink950),
      headlineLarge: GoogleFonts.fraunces(textStyle: base.headlineLarge, color: AppColors.ink950, fontWeight: FontWeight.w600),
      headlineMedium: GoogleFonts.fraunces(textStyle: base.headlineMedium, color: AppColors.ink950, fontWeight: FontWeight.w600),
      headlineSmall: GoogleFonts.fraunces(textStyle: base.headlineSmall, color: AppColors.ink950, fontWeight: FontWeight.w600),
      titleLarge: GoogleFonts.interTight(textStyle: base.titleLarge, color: AppColors.ink950, fontWeight: FontWeight.w600),
      bodyLarge: GoogleFonts.interTight(textStyle: base.bodyLarge, color: AppColors.ink700),
      bodyMedium: GoogleFonts.interTight(textStyle: base.bodyMedium, color: AppColors.ink700),
      bodySmall: GoogleFonts.interTight(textStyle: base.bodySmall, color: AppColors.ink500),
      labelLarge: GoogleFonts.interTight(textStyle: base.labelLarge, color: AppColors.ink950),
    );

    return ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: AppColors.offWhite,
      colorScheme: ColorScheme.fromSeed(
        seedColor: AppColors.ink950,
        primary: AppColors.ink950,
        secondary: AppColors.terracotta,
        surface: Colors.white,
        error: AppColors.error,
        brightness: Brightness.light,
      ),
      textTheme: textTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.offWhite,
        foregroundColor: AppColors.ink950,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.ink950,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          textStyle: textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w600),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: AppColors.ink950,
          side: const BorderSide(color: AppColors.greyLines),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: const BorderSide(color: AppColors.greyLines),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: const BorderSide(color: AppColors.greyLines),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(6),
          borderSide: const BorderSide(color: AppColors.ink950, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(color: AppColors.greyLines),
        ),
      ),
      dividerTheme: const DividerThemeData(color: AppColors.greyLines),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: AppColors.ink950,
        unselectedItemColor: AppColors.ink300,
      ),
    );
  }
}
