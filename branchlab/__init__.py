def analyze(request):
    from .core import analyze as impl

    return impl(request)
