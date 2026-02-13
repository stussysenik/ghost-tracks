"""Test configuration and fixtures."""

import os
import sys

import pytest

# Ensure backend modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
