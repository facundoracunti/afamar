class NotFoundError(Exception):
    def __init__(self, resource: str, id=None):
        self.resource = resource
        self.id = id
        msg = f"{resource} no encontrado"
        if id:
            msg += f" (id={id})"
        super().__init__(msg)


class ConflictError(Exception):
    def __init__(self, message: str):
        super().__init__(message)


class ValidationError(Exception):
    def __init__(self, message: str):
        super().__init__(message)
