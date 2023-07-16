# Copyright (C) 2022 Ethan Uppal All rights reserved.

PY = python3
PORT = 8011

serve:
	${PY} -m http.server ${PORT}
