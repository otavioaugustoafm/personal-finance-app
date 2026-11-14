"""Monta o lambda.zip: seu codigo (src/) + dependencias compiladas para a Lambda.

Uso (dentro de app-financeiro-backend):   python scripts/montar_zip_lambda.py

Por que um script e nao "zipar a pasta"? Algumas dependencias (psycopg, bcrypt, pydantic) tem partes
compiladas. Instaladas no Windows ou no Mac, nao funcionam na Lambda (Linux). Aqui o pip e instruido a baixar
as versoes para Linux x86_64 / Python 3.12, nao importa em que sistema voce esteja.

Ao criar a funcao na AWS, escolha: Runtime Python 3.12 e Arquitetura x86_64.
"""
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
BUILD = RAIZ / "build" / "lambda"
SAIDA = RAIZ / "lambda.zip"
PYTHON_LAMBDA = "3.12"
PLATAFORMAS = ["manylinux2014_x86_64", "manylinux_2_17_x86_64", "manylinux_2_28_x86_64"]
LIMITE_UPLOAD_MB = 50  # acima disso o console da AWS nao aceita upload direto


def instalar_dependencias() -> None:
    comando = [
        sys.executable, "-m", "pip", "install",
        "-r", str(RAIZ / "requirements-lambda.txt"),
        "--target", str(BUILD),
        "--only-binary=:all:",
        "--implementation", "cp",
        "--python-version", PYTHON_LAMBDA,
        "--upgrade", "--quiet", "--disable-pip-version-check",
        # O Python da Microsoft Store (e alguns pip.conf) forca "--user", que nao combina com "--target"
        "--no-user",
    ]
    for plataforma in PLATAFORMAS:
        comando += ["--platform", plataforma]
    subprocess.run(comando, check=True)


def copiar_codigo() -> None:
    shutil.copytree(RAIZ / "src", BUILD / "src", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))


def limpar() -> None:
    shutil.rmtree(BUILD / "bin", ignore_errors=True)  # scripts de linha de comando, inuteis na Lambda
    for pasta in list(BUILD.rglob("__pycache__")):
        shutil.rmtree(pasta, ignore_errors=True)


def compactar() -> None:
    SAIDA.unlink(missing_ok=True)
    with zipfile.ZipFile(SAIDA, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for caminho in sorted(BUILD.rglob("*")):
            if not caminho.is_file():
                continue
            info = zipfile.ZipInfo.from_file(caminho, caminho.relative_to(BUILD).as_posix())
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16  # legivel na Lambda mesmo se o zip foi criado no Windows
            zf.writestr(info, caminho.read_bytes())


def main() -> None:
    if not (RAIZ / "src" / "main.py").exists():
        sys.exit("Rode este script dentro da pasta app-financeiro-backend.")
    shutil.rmtree(BUILD, ignore_errors=True)
    BUILD.mkdir(parents=True)
    print("1/4 Baixando dependencias para Linux x86_64 / Python", PYTHON_LAMBDA, "...")
    instalar_dependencias()
    print("2/4 Copiando o codigo (src/) ...")
    copiar_codigo()
    print("3/4 Limpando ...")
    limpar()
    print("4/4 Gerando", SAIDA.name, "...")
    compactar()
    mb = SAIDA.stat().st_size / 1024 / 1024
    print(f"\nPronto: {SAIDA}  ({mb:.1f} MB)")
    if mb > LIMITE_UPLOAD_MB:
        print(f"ATENCAO: passa de {LIMITE_UPLOAD_MB} MB; o console da AWS nao aceita upload direto (precisaria subir via S3).")
    print("Nenhum segredo vai no zip: so o codigo de src/ e as bibliotecas.")


if __name__ == "__main__":
    main()