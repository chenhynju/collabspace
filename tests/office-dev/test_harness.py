import io
import tempfile
import time
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from harness import Vault, sign, verify, validate_ooxml, FORMATS


def fixture(extension):
    roots = {'docx': 'word/document.xml', 'xlsx': 'xl/workbook.xml', 'pptx': 'ppt/presentation.xml'}
    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w') as archive:
        archive.writestr('[Content_Types].xml', '<Types/>')
        archive.writestr(roots[extension], '<fixture/>')
    return out.getvalue()


class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / 'fixtures').mkdir()
        for extension in FORMATS.values():
            (self.root / 'fixtures' / ('baseline.' + extension)).write_bytes(fixture(extension))
        self.vault = Vault(self.root, 'synthetic-test-secret')

    def tearDown(self):
        self.temp.cleanup()

    def test_signature_and_expiry(self):
        token = sign({'exp': time.time() + 60}, 'one')
        self.assertIn('exp', verify(token, 'one'))
        for candidate, secret in [(token, 'two'), (sign({'exp': 1}, 'one'), 'one'), ('bad', 'one')]:
            with self.assertRaises(ValueError):
                verify(candidate, secret)

    def test_shared_session_viewer_and_capability_scope(self):
        a = self.vault.config('word', 'alice')
        b = self.vault.config('word', 'bob')
        viewer = self.vault.config('word', 'viewer')
        self.assertEqual(a['document']['key'], b['document']['key'])
        self.assertFalse(viewer['document']['permissions']['edit'])
        with self.assertRaises(ValueError):
            self.vault.force('word', 'viewer')
        token = self.vault.capability('word', a['document']['key'], 'read', 'alice')
        for doc, purpose in [('sheet', 'read'), ('word', 'callback')]:
            with self.assertRaises(ValueError):
                self.vault.check_capability(token, doc, purpose)

    def test_ssrf_refused_before_network(self):
        for url in ['http://169.254.169.254/cache/files/x', 'http://localhost:3390/admin',
                    'https://localhost:3390/cache/files/x', 'http://localhost:3390@evil.test/cache/files/x']:
            with self.assertRaises(ValueError):
                self.vault.download_candidate(url)

    def test_ooxml_format_and_macro_refused(self):
        validate_ooxml(fixture('docx'), 'docx')
        with self.assertRaises(ValueError):
            validate_ooxml(fixture('xlsx'), 'docx')
        data = io.BytesIO(fixture('docx'))
        with zipfile.ZipFile(data, 'a') as archive:
            archive.writestr('word/vbaProject.bin', b'not a macro')
        with self.assertRaises(ValueError):
            validate_ooxml(data.getvalue(), 'docx')

    def test_checkpoint_duplicate_out_of_order_and_stale_final(self):
        config = self.vault.config('word', 'alice')
        key = config['document']['key']
        claim = {'key': key, 'user': 'alice'}
        state = self.vault.read('word')
        state['issued'] = 2
        self.vault.write('word', state)
        body = {'key': key, 'status': 6, 'url': 'synthetic',
                'userdata': 'checkpoint:' + state['generation'] + ':2'}
        with patch.object(self.vault, 'download_candidate', return_value=fixture('docx')):
            self.assertEqual(self.vault.callback('word', claim, body), {'error': 0})
            self.assertEqual(self.vault.callback('word', claim, body), {'error': 0})
            self.assertEqual(self.vault.read('word')['revision'], 1)
            older = dict(body, userdata='checkpoint:' + state['generation'] + ':1')
            self.assertEqual(self.vault.callback('word', claim, older), {'error': 1})
            final = {'key': key, 'status': 2, 'url': 'synthetic'}
            self.assertEqual(self.vault.callback('word', claim, final), {'error': 0})
            self.vault.config('word', 'bob')
            stale = dict(final, url='old-session-different-receipt')
            self.assertEqual(self.vault.callback('word', claim, stale), {'error': 1})
            self.assertEqual(self.vault.read('word')['revision'], 2)


if __name__ == '__main__':
    unittest.main()
