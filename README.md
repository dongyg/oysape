# oysape

This is a tools to help you manage your ssh servers and your operations on those servers. It can be used as:

- SSH tool
- DevOps tool
- CI/CD tool


## Definitions

- Server.
- Task.
- Pipeline.


## Requirements

- Python 3
- Node


## Installation

``` bash
yarn run init
```

This will create a virtual environment, install pip and Node dependencies. Alternatively you can perform these steps manually.

``` bash
yarn install
pip install -r requirements.txt
```

On Linux systems installation system makes educated guesses. If you run KDE, QT dependencies are installed, otherwise GTK is chosen. `apt` is used for installing GTK dependencies. In case you are running a non apt-based system, you will have to install GTK dependencies manually. See [installation](https://pywebview.flowrl.com/guide/installation.html) for details.


## Usage

To launch the application.

``` bash
yarn run start
```

To build an executable. The output binary will be produced in the `dist` directory.

``` bash
yarn run build
```

To start a development server.

``` bash
yarn run dev
```

To clean the developement environment, this will delete `gui`, `dist`, `build` directories.

``` bash
yarn run clean
```
