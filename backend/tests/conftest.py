"""Test configuration and fixtures."""

import os
import sys

# Ensure backend modules are importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Force the default suite onto deterministic template/algorithmic fallbacks.
# main.py calls load_dotenv(override=False), so setting these to empty (present
# but falsy) both neutralizes any shell key AND prevents .env.local from
# re-injecting one. Live round-trips live in test_llm.py and read the real key
# straight from .env.local.
for _key in ("CEREBRAS_API_KEY", "GLM_API_KEY", "OPENAI_API_KEY", "NVIDIA_NIM_API_KEY"):
    os.environ[_key] = ""
