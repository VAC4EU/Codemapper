# Copyright 2017 Erasmus Medical Center, Department of Medical Informatics.
# 
# This program shall be referenced as “Codemapper”.
# 
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
# 
# You should have received a copy of the GNU Affero General Public License
# along with this program. If not, see <http://www.gnu.org/licenses/>.

import logging
import re

logger = logging.getLogger(__name__)


def normalize_upper(code):
    return code.upper()

def normalize_drop_suffix_dot(code):
    if code[-1] == '.':
        return code[:-1]
    else:
        return code

def normalize_3letters(code):
    "Clip code to three letters/digits maximum"
    return code[:3]

# Letter Digit Digit
CODE_LDD_RE = re.compile(r'(?P<parent>[A-Za-z]\d{2})\.(?P<detail>\d)')
# Digit Digit Digit
CODE_DDD_RE = re.compile(r'(?P<parent>\d{3})\.(\d)')

def normalize_xdd_code(code):
    "Cut decimals keeping only LDD and DDD, e.g., X123.4 => X123"
    code = code.upper()
    m1 = re.match(CODE_LDD_RE, code)
    try:
        return m1.group('parent')
    except:
        m2 = re.match(CODE_DDD_RE, code)
        try:
            return m2.group('parent')
        except:
            return code

def format_icd(code):
    "Insert dot in code at position 3 if necessary, e.g. C1234 => C123.4"
    if len(code) > 3 and code[3] != '.':
        return code[:3] + '.' + code[3:]
    else:
        return code


READ_RE = re.compile(r'(?P<code>[A-Za-z0-9\d][A-Za-z0-9.]{4}).*')
def normalize_read(code):
    m = READ_RE.match(code)
    if m:
        return m.group('code')
    else:
        logger.warn("Not a READ2 code: %s", code)
        return None

_normalizers = {
    'ICPC': [normalize_drop_suffix_dot, normalize_xdd_code, normalize_3letters],
    'ICD': [format_icd],
    'RCD': [normalize_read],
}

def chain(fs):
    def f(codes):
        result = set()
        for code in codes:
            for f in fs:
                res = f(code)
                if res is not None:
                    code = res
            result.add(code)
        return result
    return f

def get_normalizer(coding_system):
    for coding_system0 in _normalizers:
        if coding_system.startswith(coding_system0):
            return chain(_normalizers[coding_system0])
    logger.error("No normalizer for coding system %s", coding_system)
