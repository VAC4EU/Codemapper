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

from pathlib import Path
import os
import sys
import logging

"""
A thin wrapper of redo.
=======================

- Simple declaration of and access to dependencies

   with redo.ifchange(file1="path/to/file1",
                      files2=["path/to/file2a", "path/to/file2b"])
           as files:
       files['file1]' # opened path/to/file1
       files['files2'][0]  # openend path/to/file2a
       files['files2'][1]  # openend path/to/file2b

  The keyword arguments might be nested lists, dictionarys and tuples.
  The return value is a dictionary with exactly the same structure as
  kwargs but with filenames replaced with files.

- Easy access to the temporary output file via

      with redo.output() as f:
         ... dump your data to `f` ...

- It provides the redo command line arguments as `redo.target`,
  `redo.base` and `redo.temp`.
"""
logger = logging.getLogger("redo")

args = sys.argv[1:]

_running = sys.argv[0][-3:] == '.do'

def running():
    """ Check if the process is really running a redo script """
    return _running

if running():
    global target, base, temp, short_base, snippets, path
    target = sys.argv[1]
    base = sys.argv[2]
    temp = sys.argv[3]
    short_base = Path(base).name
    snippets = short_base.split('.')
    path = Path(target).parent.resolve()
else:
    path = Path()

def fake(target_, base_, temp_):
    print("Redo: fake")
    global _running, target, base, temp, short_base, snippets, path
    _running = True
    target = target_
    base = base_
    temp = temp_
    short_base = Path(base).name
    snippets = short_base.split('.')
    path = Path(target).parent.resolve()


def output(mode='w'):
    """ Create a file for redo's temporary output file. """
    return open(temp, mode)


def ifchange(*args, **kwargs):
    """Run the `redo-ifchange` command on all files in **kwargs. """
    return RedoCommand('redo-ifchange', args, kwargs)

def ifchange_binary(*args, **kwargs):
    """Run the `redo-ifchange` command on all files in **kwargs. """
    return RedoCommand('redo-ifchange', args, kwargs, mode='rb')


def delegate(*args, **kwargs):
    """Run the `redo-ifchange` command on all files in **kwargs. """
    return RedoCommand('redo-delegate', args, kwargs)


class RedoCommand(object):

    def __init__(self, command_name, args, kwargs, mode='r'):
        self.command_name = command_name
        self.mode = mode
        assert args or kwargs, "Provide either *args or **kwargs."
        if args and kwargs:
            self.filenames = (args, kwargs)
        elif args:
            self.filenames = args
        elif kwargs:
            self.filenames = kwargs
        def f(filename):
            return Path(path) / filename
        self.filenames = self.map_list_or_dict(self.filenames, f)
        self.run()

    @classmethod
    def map_list_or_dict(cls, value, f):
        """(Recursively) map the values of a list, dict or tuple., applying
        `f` on all values that are not list, dict or tuple. """
        if type(value) == list:
            return [cls.map_list_or_dict(value0, f)
                    for value0 in value]
        elif type(value) == dict:
            return {key: cls.map_list_or_dict(value0, f)
                    for key, value0 in value.items()}
        elif type(value) == tuple:
            return tuple(cls.map_list_or_dict(value0, f)
                         for value0 in value)
        else:
            return f(value)

    def run(self):
        all_filenames = []
        self.map_list_or_dict(self.filenames, all_filenames.append)
        all_filenames_str = ' '.join('"{}"'.format(filename)
                                     for filename in all_filenames)
        command = self.command_name + ' ' + all_filenames_str
        res = os.system(command)
        if res != 0:
            print("Redo failed")
            exit(res)

    def __enter__(self):
        def f(filename):
            logger.debug("Open %s", filename)
            return open(str(filename), self.mode)
        self.files = self.map_list_or_dict(self.filenames, f)
        if type(self.files) == tuple and len(self.files) == 1:
            return self.files[0]
        else:
            return self.files

    def __exit__(self, type_, value, traceback):
        self.map_list_or_dict(self.files, lambda f: f.close())


