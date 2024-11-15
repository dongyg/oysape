# oysape

This is a tools to help you manage your ssh servers and your operations on those servers. It can be used as:

- SSH tool
- DevOps tool
- CI/CD tool

> This app is developed based on [React](https://reactjs.org/), [Ant Design](https://ant.design/) and [PyWebview](https://pywebview.flowrl.com/)

## Definitions

- Server.
- Task.
- Pipeline.


## Requirements

- Python 3
- Node


## Installation

``` bash
yarn install
yarn run init
```

This will create a virtual environment, install pip and Node dependencies.

On Linux systems installation system makes educated guesses. If you run KDE, QT dependencies are installed, otherwise GTK is chosen. `apt` is used for installing GTK dependencies. In case you are running a non apt-based system, you will have to install GTK dependencies manually. See [installation](https://pywebview.flowrl.com/guide/installation.html) for details.


## Usage

### Running with source code

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

### Running with docker container

```
docker run --rm --name oyhost -p 19790:19790 -itd oysape/webhost
```

Then open http://localhost:19790 with your favorite browser.

> Unrecommended for desktop usage. Use desktop version instead. That will give you more convenience to access your local files.

