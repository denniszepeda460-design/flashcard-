import pytest
import tempfile
import os

@pytest.fixture
def temp_collection():
    try:
        from anki.collection import Collection
    except ImportError:
        pytest.skip("anki package not installed")
        
    temp_dir = tempfile.mkdtemp()
    col_path = os.path.join(temp_dir, "test_collection.anki2")
    col = Collection(col_path)
    yield col
    col.close()
