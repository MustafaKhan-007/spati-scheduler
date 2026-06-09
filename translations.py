"""
translations.py
All UI strings for the three supported languages.
Add a new language by duplicating one block and updating values.
"""
from flask import session

TRANSLATIONS = {
    # ── English ───────────────────────────────────────────────
    "en": {
        # Page titles
        "page_login":    "Login — Spati Scheduler",
        "page_employee": "My Availability — Spati Scheduler",
        "page_admin":    "Admin Dashboard — Spati Scheduler",

        # Login page
        "login_subtitle":        "Employee scheduling for your store",
        "username":               "Username",
        "username_placeholder":  "Enter your username",
        "password":               "Password",
        "password_placeholder":  "Enter your password",
        "login_btn":              "Log In",
        "invalid_credentials":   "Invalid username or password.",

        # Shared header / nav
        "logout":   "Logout",
        "week_of":  "Week of",
        "week":     "Week",

        # Employee dashboard
        "greeting":             "Hey",
        "my_availability":      "Set Your Availability",
        "save_availability":    "Save Availability",
        "accent_colour_title":  "Your Accent Colour",
        "accent_colour_hint":   "Shown on your name tags in the schedule",

        # Admin dashboard panels
        "admin_label":     "Admin",
        "employees":       "Employees",
        "overlay_hint":    "Select to overlay availability",
        "search_placeholder": "🔍 Search employees…",
        "export_image":    "Export as Image",
        "no_employees":    "No employees found.\nRun seed.py first.",
        "no_branches":     "No branches — run seed.py first.",

        # Legend
        "avail_set":         "Availability set",
        "avail_not_set":     "Availability not set",

        "legend_available":  "Available",
        "legend_unavail":    "Unavailable",
        "legend_assigned":   "Assigned here",
        "legend_elsewhere":  "Assigned elsewhere",
        "legend_neutral":    "No selection",

        # Day abbreviations (Mon–Sun)
        "days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],

        # Shift-slot labels
        "slot_morning": "Morning",
        "slot_evening": "Evening",
        "slot_night":   "Night",

        # JS toast / conflict strings
        "toast_saved":        "✓ Availability saved!",
        "toast_save_err":     "✗ Could not save. Try again.",
        "toast_net_err":      "✗ Network error.",
        "toast_colour_saved": "✓ Accent colour saved!",
        "toast_colour_err":   "✗ Could not save colour.",
        # {name} and {branch} are replaced in JS
        "conflict_msg":   "✗ {name} is already assigned to \"{branch}\" for this slot.",
        "slot_taken_msg": "✗ This slot is already filled by {name}.",
    },

    # ── German ────────────────────────────────────────────────
    "de": {
        "page_login":    "Anmelden — Spati Scheduler",
        "page_employee": "Meine Verfügbarkeit — Spati Scheduler",
        "page_admin":    "Admin-Dashboard — Spati Scheduler",

        "login_subtitle":        "Mitarbeiterplanung für deinen Laden",
        "username":               "Benutzername",
        "username_placeholder":  "Benutzernamen eingeben",
        "password":               "Passwort",
        "password_placeholder":  "Passwort eingeben",
        "login_btn":              "Anmelden",
        "invalid_credentials":   "Ungültiger Benutzername oder Passwort.",

        "logout":   "Abmelden",
        "week_of":  "Woche vom",
        "week":     "Woche",

        "greeting":             "Hallo",
        "my_availability":      "Verfügbarkeit festlegen",
        "save_availability":    "Verfügbarkeit speichern",
        "accent_colour_title":  "Deine Akzentfarbe",
        "accent_colour_hint":   "Erscheint auf deinem Namensschildchen im Dienstplan",

        "admin_label":     "Admin",
        "employees":       "Mitarbeiter",
        "overlay_hint":    "Auswählen zum Einblenden der Verfügbarkeit",
        "search_placeholder": "🔍 Mitarbeiter suchen…",
        "export_image":    "Als Bild exportieren",
        "no_employees":    "Keine Mitarbeiter gefunden.\nBitte seed.py ausführen.",
        "no_branches":     "Keine Filialen — bitte seed.py ausführen.",

        "avail_set":         "Verfügbarkeit gesetzt",
        "avail_not_set":     "Verfügbarkeit nicht gesetzt",

        "legend_available":  "Verfügbar",
        "legend_unavail":    "Nicht verfügbar",
        "legend_assigned":   "Hier eingeplant",
        "legend_elsewhere":  "Anderswo eingeplant",
        "legend_neutral":    "Keine Auswahl",

        "days": ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],

        "slot_morning": "Frühschicht",
        "slot_evening": "Spätschicht",
        "slot_night":   "Nachtschicht",

        "toast_saved":        "✓ Verfügbarkeit gespeichert!",
        "toast_save_err":     "✗ Speichern fehlgeschlagen. Bitte erneut versuchen.",
        "toast_net_err":      "✗ Netzwerkfehler.",
        "toast_colour_saved": "✓ Akzentfarbe gespeichert!",
        "toast_colour_err":   "✗ Farbe konnte nicht gespeichert werden.",
        "conflict_msg":   "✗ {name} ist für diesen Slot bereits in \"{branch}\" eingeplant.",
        "slot_taken_msg": "✗ Dieser Slot ist bereits von {name} belegt.",
    },

    # ── Turkish ───────────────────────────────────────────────
    "tr": {
        "page_login":    "Giriş — Spati Scheduler",
        "page_employee": "Müsaitliğim — Spati Scheduler",
        "page_admin":    "Yönetici Paneli — Spati Scheduler",

        "login_subtitle":        "Mağazanız için çalışan planlaması",
        "username":               "Kullanıcı Adı",
        "username_placeholder":  "Kullanıcı adınızı girin",
        "password":               "Şifre",
        "password_placeholder":  "Şifrenizi girin",
        "login_btn":              "Giriş Yap",
        "invalid_credentials":   "Geçersiz kullanıcı adı veya şifre.",

        "logout":   "Çıkış Yap",
        "week_of":  "Hafta:",
        "week":     "Hafta",

        "greeting":             "Merhaba",
        "my_availability":      "Müsaitliğinizi Belirleyin",
        "save_availability":    "Müsaitliği Kaydet",
        "accent_colour_title":  "Vurgu Renginiz",
        "accent_colour_hint":   "Programdaki isim etiketlerinizde gösterilir",

        "admin_label":     "Yönetici",
        "employees":       "Çalışanlar",
        "overlay_hint":    "Müsaitliği görmek için seçin",
        "search_placeholder": "🔍 Çalışan ara…",
        "export_image":    "Görüntü Olarak Dışa Aktar",
        "no_employees":    "Çalışan bulunamadı.\nLütfen seed.py çalıştırın.",
        "no_branches":     "Şube yok — lütfen seed.py çalıştırın.",

        "avail_set":         "Müsaitlik belirlendi",
        "avail_not_set":     "Müsaitlik belirlenmedi",

        "legend_available":  "Müsait",
        "legend_unavail":    "Müsait Değil",
        "legend_assigned":   "Buraya atandı",
        "legend_elsewhere":  "Başka şubede atandı",
        "legend_neutral":    "Seçim yok",

        "days": ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"],

        "slot_morning": "Sabah",
        "slot_evening": "Akşam",
        "slot_night":   "Gece",

        "toast_saved":        "✓ Müsaitlik kaydedildi!",
        "toast_save_err":     "✗ Kaydedilemedi. Lütfen tekrar deneyin.",
        "toast_net_err":      "✗ Ağ hatası.",
        "toast_colour_saved": "✓ Vurgu rengi kaydedildi!",
        "toast_colour_err":   "✗ Renk kaydedilemedi.",
        "conflict_msg":   "✗ {name} bu slot için zaten \"{branch}\" şubesine atandı.",
        "slot_taken_msg": "✗ Bu slot zaten {name} tarafından dolu.",
    },
}

SUPPORTED = ("en", "de", "tr")


def get_t() -> dict:
    """Return the translation dict for the current request's language."""
    lang = session.get("lang", "en")
    return TRANSLATIONS.get(lang, TRANSLATIONS["en"])
