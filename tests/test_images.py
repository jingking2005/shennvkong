"""Tests for image filtering logic."""

import pytest
from valkyrie.images import is_card_image, sanitize_dirname


class TestIsCardImage:
    def test_card_image_accepted(self):
        assert is_card_image("Amaterasu.png") is True

    def test_awakened_card_image(self):
        assert is_card_image("Amaterasu_H.png") is True

    def test_icon_excluded(self):
        assert is_card_image("Amaterasu_icon.png") is False

    def test_h_icon_excluded(self):
        assert is_card_image("Amaterasu_H_icon.png") is False

    def test_element_badge_excluded(self):
        assert is_card_image("Passion.png") is False

    def test_rarity_badge_excluded(self):
        assert is_card_image("SR.png") is False

    def test_orb_excluded(self):
        assert is_card_image("Passion_Orb.png") is False

    def test_stone_excluded(self):
        assert is_card_image("Passion_Stone_(L).png") is False

    def test_god_rarity_excluded(self):
        assert is_card_image("GSR.png") is False

    def test_non_image_rejected(self):
        assert is_card_image("readme.txt") is False

    def test_jpg_accepted(self):
        assert is_card_image("SomeCard.jpg") is True


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
