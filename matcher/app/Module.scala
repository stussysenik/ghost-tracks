import com.google.inject.AbstractModule
import services.GraphHopperService

/**
 * Play auto-loads a top-level `Module`. We bind GraphHopperService as an EAGER singleton so
 * the (slow) OSM graph import/load happens at application boot rather than on the first
 * `/match` request.
 */
class Module extends AbstractModule {
  override def configure(): Unit = {
    bind(classOf[GraphHopperService]).asEagerSingleton()
  }
}
