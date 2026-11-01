"""İçe aktarım hataları: kendi denetimlerimiz (Türkçe, kullanıcıya gösterilir) ve okunamayan dosya."""


class ImportFormatError(Exception):
    """Dosya okundu ama beklenen biçimde değil; mesaj Türkçedir ve kullanıcıya gösterilebilir."""


class UnreadableFileError(Exception):
    """Kütüphane dosyayı okuyamadı (bozuk zip, bozuk XML …). Ayrıntı yalnızca sunucu loguna gider:
    openpyxl mesajları dosya yolunu içerir (docs/conventions.md, Known traps)."""
