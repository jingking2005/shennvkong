"""Tests for image filtering logic."""

import pytest
from valkyrie.images import is_card_image, sanitize_dirname


class TestIsCardImage:
    def test_card_image_accepted(self):
        assert is_card_image("Amaterasu.png", "Amaterasu") is True

    def test_awakened_card_image(self):
        assert is_card_image("Amaterasu_H.png", "Amaterasu") is True

    def test_icon_excluded(self):
        assert is_card_image("Amaterasu_icon.png", "Amaterasu") is False

    def test_h_icon_excluded(self):
        assert is_card_image("Amaterasu_H_icon.png", "Amaterasu") is False

    def test_element_badge_excluded(self):
        assert is_card_image("Passion.png", "Amaterasu") is False

    def test_rarity_badge_excluded(self):
        assert is_card_image("SR.png", "Amaterasu") is False

    def test_orb_excluded(self):
        assert is_card_image("Passion_Orb.png", "Amaterasu") is False

    def test_stone_excluded(self):
        assert is_card_image("Passion_Stone_(L).png", "Amaterasu") is False

    def test_god_rarity_excluded(self):
        assert is_card_image("GSR.png", "Amaterasu") is False

    def test_non_image_rejected(self):
        assert is_card_image("readme.txt", "Amaterasu") is False

    def test_jpg_accepted(self):
        assert is_card_image("SomeCard.jpg", "SomeCard") is True

    def test_evolution_material_rejected(self):
        """Materials like Light_U.png should be rejected when card_name given."""
        assert is_card_image("Light_U.png", "Ababinili") is False

    def test_summon_ticket_rejected(self):
        assert is_card_image("Box_Summon_Ticket.png", "Ababinili") is False

    def test_amalg_rejected(self):
        assert is_card_image("Amalg_cross.png", "Ababinili") is False

    def test_evolved_variant_accepted(self):
        """Blazing_Ababinili_H.png contains card name, should be accepted."""
        assert is_card_image("Blazing_Ababinili_H.png", "Ababinili") is True

    def test_no_card_name_blacklist_only(self):
        """Without card_name, only blacklist filtering applies."""
        assert is_card_image("SomeCard.png") is True
        assert is_card_image("Passion.png") is False


class TestSanitizeDirname:
    def test_normal_name(self):
        assert sanitize_dirname("Amaterasu") == "Amaterasu"

    def test_name_with_colon(self):
        result = sanitize_dirname("Card:Special")
        assert ":" not in result

    def test_name_with_slash(self):
        result = sanitize_dirname("Card/Special")
        assert "/" not in result

    def test_empty_name(self):
        assert sanitize_dirname("") == "unknown"

    def test_dots_only(self):
        assert sanitize_dirname("...") == "unknown"
